import { beforeAll, describe, expect, it } from "vitest";
import { as, freshDb, mkUser, type Db } from "./harness";

/**
 * The banned-item rule used to live only in src/lib/banned.ts, reached through
 * validateListing / validateWanted. Because `authenticated` holds a direct insert
 * grant, a signed-in employee posting straight to PostgREST bypassed it and the item
 * reached the signed-out Browse page. Migration 0006 moves the rule into the database.
 * These tests exercise the real SQL, not the TypeScript. (BUG-003)
 */

const insertListing = (db: Db, owner: string, title: string, description: string, wanted: string | null = null) =>
  db.query(
    `insert into listings (owner_id, title, description, category, condition, type, location, wanted_in_return)
     values ($1, $2, $3, 'Other', 'good', $4, 'Haridwar', $5)`,
    [owner, title, description, wanted ? "exchange" : "donate", wanted]);

describe("banned items are refused by the database", () => {
  let db: Db, uid: string;

  beforeAll(async () => {
    db = await freshDb();
    uid = await mkUser(db, "poster@rubicotech.in");
  });

  it("refuses a banned word in the title, even posted directly to the table", async () => {
    await expect(as(db, uid, () =>
      insertListing(db, uid, "Smith & Wesson firearm", "Barely used."),
    )).rejects.toThrow(/firearm/i);
  });

  it("refuses a banned word in the description", async () => {
    await expect(as(db, uid, () =>
      insertListing(db, uid, "Storage box", "Comes with leftover antibiotics."),
    )).rejects.toThrow(/antibiotics/i);
  });

  it("refuses a banned word in wanted_in_return", async () => {
    await expect(as(db, uid, () =>
      insertListing(db, uid, "Bookshelf", "Pine, three shelves.", "a rifle"),
    )).rejects.toThrow(/rifle/i);
  });

  it("refuses an edit that introduces a banned word", async () => {
    await as(db, uid, () => insertListing(db, uid, "Android tablet", "Ten inch, good battery."));
    await expect(as(db, uid, () =>
      db.query(`update listings set description = 'Comes with free painkillers' where title = 'Android tablet'`),
    )).rejects.toThrow(/painkillers/i);
  });

  it("refuses a banned wanted post", async () => {
    await expect(as(db, uid, () =>
      db.query(
        `insert into wanted_posts (poster_id, title, description, category, location)
         values ($1, 'Looking for explosives', 'For a project.', 'Other', 'Haridwar')`, [uid]),
    )).rejects.toThrow(/explosives/i);
  });

  it("still allows glue guns, tablets and kitchen knives", async () => {
    await as(db, uid, async () => {
      await insertListing(db, uid, "Cordless glue gun", "Includes spare sticks.");
      await insertListing(db, uid, "Kitchen knife set", "Six pieces, sharp.");
    });
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from listings where title in ('Cordless glue gun','Kitchen knife set','Android tablet')`);
    expect(rows[0].n).toBe(3);
  });

  it("keeps the word list out of reach of ordinary users", async () => {
    await expect(as(db, uid, () => db.query(`select * from banned_keywords`))).rejects.toThrow();
  });
});
