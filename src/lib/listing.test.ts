import { describe, expect, it } from "vitest";
import { cleanFilters, cleanSearch, priceLabel, timeAgo, validateListing, type ListingInput } from "./listing";

const ok: ListingInput = { title: "Study desk", description: "Solid wood", category: "Furniture", condition: "good", type: "donate", location: "Dehradun" };

describe("validateListing", () => {
  it("accepts a valid donation", () => expect(validateListing(ok)).toBeNull());
  it("rejects short title", () => expect(validateListing({ ...ok, title: "ab" })).toMatch(/Title/));
  it("rejects bad location", () => expect(validateListing({ ...ok, location: "Delhi" })).toMatch(/Haridwar/));
  it("requires price for sell only", () => {
    expect(validateListing({ ...ok, type: "sell" })).toMatch(/price/);
    expect(validateListing({ ...ok, type: "sell", asking_price: "-5" })).toMatch(/price/);
    expect(validateListing({ ...ok, type: "sell", asking_price: "500" })).toBeNull();
  });
  it("blocks banned items in title, description or wanted-in-return", () => {
    expect(validateListing({ ...ok, title: "Spare medicines" })).toMatch(/cannot be listed/);
    expect(validateListing({ ...ok, description: "an old Rifle" })).toMatch(/cannot be listed/);
    expect(validateListing({ ...ok, type: "exchange", wanted_in_return: "pistol" })).toMatch(/cannot be listed/);
  });
  it("allows glue gun", () => expect(validateListing({ ...ok, title: "Glue gun" })).toBeNull());
});

describe("cleanSearch", () => {
  it("removes filter-breaking characters", () => expect(cleanSearch("a,b)(c%d_e")).toBe("a b  c d e"));
});

import { freePositions } from "./listing";
describe("freePositions", () => {
  it("fills gaps first and never exceeds 4 slots", () => {
    expect(freePositions([0, 2], 5)).toEqual([1, 3]);
    expect(freePositions([], 2)).toEqual([0, 1]);
    expect(freePositions([0, 1, 2, 3], 1)).toEqual([]);
  });
});

import { validateWanted } from "./listing";
describe("validateWanted", () => {
  const w = { title: "Need a desk", description: "Study desk please", category: "Furniture", location: "Haridwar" };
  it("accepts a valid post", () => expect(validateWanted(w)).toBeNull());
  it("rejects bad input and banned items", () => {
    expect(validateWanted({ ...w, title: "x" })).toMatch(/Title/);
    expect(validateWanted({ ...w, location: "Pune" })).toMatch(/Haridwar/);
    expect(validateWanted({ ...w, description: "any medicines" })).toMatch(/cannot be requested/);
  });
});

describe("tile helpers", () => {
  const now = new Date("2026-10-21T12:00:00Z").getTime();
  it("timeAgo", () => {
    expect(timeAgo("2026-10-21T01:00:00Z", now)).toBe("today");
    expect(timeAgo("2026-10-20T01:00:00Z", now)).toBe("yesterday");
    expect(timeAgo("2026-10-16T12:00:00Z", now)).toBe("5 days ago");
    expect(timeAgo("2026-08-01T12:00:00Z", now)).toBe("2 months ago");
  });
  it("priceLabel", () => {
    expect(priceLabel("sell", 500)).toBe("₹500");
    expect(priceLabel("donate", null)).toBe("Free");
    expect(priceLabel("lend", null)).toBe("Lend");
  });
});

describe("cleanFilters", () => {
  it("drops values the dropdowns do not offer", () =>
    expect(cleanFilters({ category: "bogus", type: "bogus", location: "Mars", q: " " })).toEqual({ q: undefined, category: undefined, location: undefined, type: undefined }));
  it("keeps valid values", () =>
    expect(cleanFilters({ category: "Books", type: "donate", location: "Dehradun", q: "desk" })).toEqual({ q: "desk", category: "Books", location: "Dehradun", type: "donate" }));
});

import { validateRequest } from "./listing";
describe("validateRequest", () => {
  it("accepts a normal message", () => expect(validateRequest("Could I collect this on Friday?")).toBeNull());
  it("rejects an empty or whitespace-only message", () => {
    // HTML `required` accepts spaces, so without this the database rejects it instead.
    expect(validateRequest("")).toMatch(/short message/);
    expect(validateRequest("     ")).toMatch(/short message/);
  });
  it("rejects a message past the column limit", () => {
    expect(validateRequest("x".repeat(1001))).toMatch(/under 1000/);
    expect(validateRequest("x".repeat(1000))).toBeNull();
  });
  it("rejects over-long offered items", () => {
    expect(validateRequest("hello", "y".repeat(1001))).toMatch(/offering under 1000/);
    expect(validateRequest("hello", "y".repeat(1000))).toBeNull();
  });
});
