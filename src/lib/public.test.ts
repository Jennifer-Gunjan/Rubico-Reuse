import { describe, expect, it } from "vitest";
import { PAGE_SIZE, cleanPage, cleanSort, liveListings } from "./public";

describe("cleanSort", () => {
  it("defaults to newest first", () => {
    expect(cleanSort(undefined)).toBe("new");
    expect(cleanSort("")).toBe("new");
  });
  it("accepts the one alternative the control offers", () => expect(cleanSort("old")).toBe("old"));
  it("ignores anything else, so a bad URL still sorts", () => {
    expect(cleanSort("asking_price desc; drop table listings")).toBe("new");
    expect(cleanSort("newest")).toBe("new");
  });
});

describe("cleanPage", () => {
  it("defaults to the first page", () => {
    expect(cleanPage(undefined)).toBe(1);
    expect(cleanPage("")).toBe(1);
  });
  it("keeps a real page number", () => expect(cleanPage("7")).toBe(7));
  it("refuses zero, negatives and fractions rather than producing a bad range", () => {
    expect(cleanPage("0")).toBe(1);
    expect(cleanPage("-3")).toBe(1);
    expect(cleanPage("2.5")).toBe(1);
  });
  it("ignores junk", () => {
    expect(cleanPage("abc")).toBe(1);
    expect(cleanPage("1; drop table listings")).toBe(1);
  });
});

/**
 * A stand-in for the PostgREST client that records what was asked for and replays
 * fixed rows, so the cover-selection and paging rules can be checked without a database.
 */
function fakeDb(listings: { id: string }[], images: { listing_id: string; storage_path: string; position: number }[]) {
  const seen: { range?: [number, number]; ascending?: boolean } = {};
  const client = {
    from(table: string) {
      const where: Record<string, unknown> = {};
      // Honours eq() so the old implementation, which asked for position 0 exactly,
      // genuinely fails these tests rather than passing on a permissive double.
      const resolveImages = async () => ({
        data: images
          .filter((r) => Object.entries(where).every(([c, v]) => (r as unknown as Record<string, unknown>)[c] === v))
          .sort((a, b) => a.position - b.position),
      });
      const q = {
        select: () => q,
        in: () => q,
        or: () => q,
        eq: (c: string, v: unknown) => { where[c] = v; return q; },
        order: (_col: string, opts?: { ascending?: boolean }) => {
          if (table === "public_listings") { seen.ascending = opts?.ascending; return q; }
          return resolveImages();
        },
        range: (from: number, to: number) => { seen.range = [from, to]; return Promise.resolve({ data: listings }); },
        // PostgREST builders are thenable, so awaiting one without a terminal call works.
        then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
          (table === "public_listing_images" ? resolveImages() : Promise.resolve({ data: listings })).then(ok, bad),
      };
      return q;
    },
  };
  return { client, seen };
}

const run = (listings: { id: string }[], images: { listing_id: string; storage_path: string; position: number }[], f = {}) => {
  const { client, seen } = fakeDb(listings, images);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return liveListings(client as any, f).then((items) => ({ items, seen }));
};

describe("liveListings cover photo", () => {
  it("uses the photo in the first slot when there is one", async () => {
    const { items } = await run([{ id: "a" }], [
      { listing_id: "a", storage_path: "cover.png", position: 0 },
      { listing_id: "a", storage_path: "second.png", position: 1 },
    ]);
    expect(items[0].image).toBe("cover.png");
  });

  it("falls back to the lowest remaining slot after the first photo is removed", async () => {
    // Removing the first of two photos leaves the survivor in slot 1 and nothing
    // renumbers it. Matching slot 0 exactly made the listing look like it had no photo.
    const { items } = await run([{ id: "a" }], [{ listing_id: "a", storage_path: "second.png", position: 1 }]);
    expect(items[0].image).toBe("second.png");
  });

  it("still reports no photo when a listing genuinely has none", async () => {
    const { items } = await run([{ id: "a" }], []);
    expect(items[0].image).toBeNull();
  });

  it("gives each listing its own cover", async () => {
    const { items } = await run([{ id: "a" }, { id: "b" }], [
      { listing_id: "b", storage_path: "b3.png", position: 3 },
      { listing_id: "a", storage_path: "a2.png", position: 2 },
    ]);
    expect(items.find((i) => i.id === "a")!.image).toBe("a2.png");
    expect(items.find((i) => i.id === "b")!.image).toBe("b3.png");
  });
});

describe("liveListings paging and sort", () => {
  it("asks for the first page by default", async () => {
    const { seen } = await run([{ id: "a" }], []);
    expect(seen.range).toEqual([0, PAGE_SIZE - 1]);
  });
  it("offsets by whole pages", async () => {
    const { seen } = await run([{ id: "a" }], [], { page: 3 });
    expect(seen.range).toEqual([PAGE_SIZE * 2, PAGE_SIZE * 3 - 1]);
  });
  it("treats a page below one as the first page", async () => {
    const { seen } = await run([{ id: "a" }], [], { page: 0 });
    expect(seen.range).toEqual([0, PAGE_SIZE - 1]);
  });
  it("honours an explicit limit, so the landing page still asks for 8", async () => {
    const { seen } = await run([{ id: "a" }], [], { limit: 8 });
    expect(seen.range).toEqual([0, 7]);
  });
  it("sorts newest first by default and oldest first on request", async () => {
    expect((await run([{ id: "a" }], [])).seen.ascending).toBe(false);
    expect((await run([{ id: "a" }], [], { sort: "old" })).seen.ascending).toBe(true);
  });
});

import { narrowing } from "./public";
describe("narrowing", () => {
  it("asks for nothing when no filter is set", () => {
    expect(narrowing({})).toEqual({ or: undefined, eq: [] });
  });
  it("searches title and description together", () => {
    expect(narrowing({ q: "desk" }).or).toBe("title.ilike.%desk%,description.ilike.%desk%");
  });
  it("strips characters that would break the search filter", () => {
    // cleanSearch runs first, so a crafted query cannot add its own conditions.
    expect(narrowing({ q: "a,b)(c" }).or).toBe("title.ilike.%a b  c%,description.ilike.%a b  c%");
  });
  it("carries each dropdown as its own equality", () => {
    expect(narrowing({ category: "Books", location: "Dehradun", type: "donate" }).eq)
      .toEqual([["category", "Books"], ["location", "Dehradun"], ["type", "donate"]]);
  });
  it("ignores an empty search so it does not match everything twice", () => {
    expect(narrowing({ q: "   " }).or).toBeUndefined();
  });
});
