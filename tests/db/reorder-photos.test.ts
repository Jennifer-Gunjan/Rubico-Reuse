import { beforeEach, describe, expect, it } from "vitest";
import { as, freshDb, mkListing, mkUser, type Db } from "./harness";

/**
 * The cover is whichever photo sits lowest. Promoting one means renumbering, and
 * `unique (listing_id, position)` with positions capped at 0..3 leaves no spare slot to swap
 * through - a plain swap fails on the index mid-statement. 0016 makes the constraint
 * deferrable so one statement can renumber everything and be checked once, at the end.
 */

let db: Db, owner: string, other: string, listing: string;

const addPhoto = (l: string, pos: number) =>
  db.query<{ id: string }>(
    `insert into listing_images (listing_id, storage_path, position)
     values ($1, $2, $3) returning id`, [l, `p${pos}.png`, pos]);

const slots = async (l: string) =>
  (await db.query<{ storage_path: string; position: number }>(
    `select storage_path, position from listing_images where listing_id = $1 order by position`, [l])).rows;

beforeEach(async () => {
  db = await freshDb();
  owner = await mkUser(db, "owner@rubicotech.com");
  other = await mkUser(db, "other@rubicotech.com");
  listing = await mkListing(db, owner);
});

describe("choosing which photo is the cover", () => {
  it("promotes a photo to the front, moving the others down", async () => {
    const a = (await addPhoto(listing, 0)).rows[0].id;
    const b = (await addPhoto(listing, 1)).rows[0].id;
    const c = (await addPhoto(listing, 2)).rows[0].id;

    await as(db, owner, () => db.query(`select reorder_listing_photos($1, $2)`, [listing, [c, a, b]]));

    expect(await slots(listing)).toEqual([
      { storage_path: "p2.png", position: 0 },
      { storage_path: "p0.png", position: 1 },
      { storage_path: "p1.png", position: 2 },
    ]);
  });

  it("swaps two photos, which a plain update could not do", async () => {
    // Two rows trading positions is exactly the case the unique index rejects mid-statement.
    const a = (await addPhoto(listing, 0)).rows[0].id;
    const b = (await addPhoto(listing, 1)).rows[0].id;
    await as(db, owner, () => db.query(`select reorder_listing_photos($1, $2)`, [listing, [b, a]]));
    expect((await slots(listing)).map((r) => r.storage_path)).toEqual(["p1.png", "p0.png"]);
  });

  it("closes the gap a deleted cover leaves behind", async () => {
    // The root cause behind the Browse cover bug: delete slot 0 and the survivor sits at 1,
    // with nothing renumbering it. Reordering makes positions contiguous from 0 again.
    await addPhoto(listing, 0);
    const b = (await addPhoto(listing, 1)).rows[0].id;
    await db.query(`delete from listing_images where position = 0 and listing_id = $1`, [listing]);
    expect((await slots(listing))[0].position).toBe(1);

    await as(db, owner, () => db.query(`select reorder_listing_photos($1, $2)`, [listing, [b]]));
    expect(await slots(listing)).toEqual([{ storage_path: "p1.png", position: 0 }]);
  });

  it("leaves the constraint enforced for everyone else", async () => {
    // Deferrable, but still INITIALLY IMMEDIATE: an ordinary clash must still fail at once.
    await addPhoto(listing, 0);
    await expect(addPhoto(listing, 0)).rejects.toThrow();
  });

  it("only the owner can reorder", async () => {
    const a = (await addPhoto(listing, 0)).rows[0].id;
    await expect(as(db, other, () => db.query(`select reorder_listing_photos($1, $2)`, [listing, [a]])))
      .rejects.toThrow(/owner/);
  });

  it("refuses a partial list, which would leave the rest colliding", async () => {
    const a = (await addPhoto(listing, 0)).rows[0].id;
    await addPhoto(listing, 1);
    await expect(as(db, owner, () => db.query(`select reorder_listing_photos($1, $2)`, [listing, [a]])))
      .rejects.toThrow(/full set/);
  });

  it("refuses a photo belonging to another item", async () => {
    const mine = (await addPhoto(listing, 0)).rows[0].id;
    const theirs = await mkListing(db, other, "donate", "Their chair");
    const stranger = (await addPhoto(theirs, 0)).rows[0].id;
    await expect(as(db, owner, () => db.query(`select reorder_listing_photos($1, $2)`, [listing, [mine, stranger]])))
      .rejects.toThrow(/full set|do not belong/);
  });

  it("refuses the same photo listed twice", async () => {
    const a = (await addPhoto(listing, 0)).rows[0].id;
    await addPhoto(listing, 1);
    await expect(as(db, owner, () => db.query(`select reorder_listing_photos($1, $2)`, [listing, [a, a]])))
      .rejects.toThrow(/twice/);
  });

  it("keeps every position inside the allowed range", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) ids.push((await addPhoto(listing, i)).rows[0].id);
    await as(db, owner, () => db.query(`select reorder_listing_photos($1, $2)`, [listing, ids.reverse()]));
    expect((await slots(listing)).map((r) => r.position)).toEqual([0, 1, 2, 3]);
  });
});
