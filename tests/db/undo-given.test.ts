import { beforeEach, describe, expect, it } from "vitest";
import { as, freshDb, mkListing, mkUser, status, type Db } from "./harness";

/**
 * "Given" used to be terminal. One misclick permanently ended a listing, with no undo and no
 * admin override - and the button sits next to "Deal fell through", which means the opposite.
 *
 * Permanent is defensible; permanent-by-accident is not. 0014 adds a correction window
 * rather than full reversibility.
 */

let db: Db, owner: string, seeker: string, other: string;

/**
 * Moves a listing's clock back. listings_guard sets updated_at = now() on every write, so a
 * plain update cannot age a row - the trigger overwrites it. Disabling the trigger for the
 * one statement is how the passage of time is simulated.
 */
const age = async (listing: string, interval: string) => {
  await db.exec(`alter table listings disable trigger listings_guard`);
  await db.query(`update listings set updated_at = now() - $2::interval where id = $1`, [listing, interval]);
  await db.exec(`alter table listings enable trigger listings_guard`);
};

/** Takes a donation all the way to given, which is where the correction window starts. */
const given = async () => {
  const l = await mkListing(db, owner);
  const r = await as(db, seeker, async () =>
    (await db.query<{ create_request: string }>(`select create_request($1, $2)`, [l, "Please"])).rows[0].create_request);
  await as(db, owner, () => db.query(`select accept_request($1)`, [r]));
  await as(db, owner, () => db.query(`update listings set status = 'given' where id = $1`, [l]));
  return l;
};

beforeEach(async () => {
  db = await freshDb();
  owner = await mkUser(db, "owner@rubicotech.com");
  seeker = await mkUser(db, "seeker@rubicotech.in");
  other = await mkUser(db, "other@rubicotech.com");
});

describe("taking back a mistaken Given", () => {
  it("puts the item back to accepted", async () => {
    const l = await given();
    expect(await status(db, l)).toBe("given");
    await as(db, owner, () => db.query(`select undo_given($1)`, [l]));
    expect(await status(db, l)).toBe("accepted");
  });

  it("leaves the same two people matched", async () => {
    const l = await given();
    await as(db, owner, () => db.query(`select undo_given($1)`, [l]));
    // The request was never touched when the item was marked given, so the pair survives.
    const { rows } = await db.query<{ status: string; seeker_id: string }>(
      `select status, seeker_id from requests where listing_id = $1`, [l]);
    expect(rows).toEqual([{ status: "accepted", seeker_id: seeker }]);
  });

  it("refuses once the window has passed", async () => {
    const l = await given();
    await age(l, "25 hours");
    await expect(as(db, owner, () => db.query(`select undo_given($1)`, [l])))
      .rejects.toThrow(/more than a day ago/);
    expect(await status(db, l)).toBe("given");
  });

  it("still allows it just inside the window", async () => {
    const l = await given();
    await age(l, "23 hours");
    await as(db, owner, () => db.query(`select undo_given($1)`, [l]));
    expect(await status(db, l)).toBe("accepted");
  });

  it("only the owner can do it", async () => {
    const l = await given();
    await expect(as(db, seeker, () => db.query(`select undo_given($1)`, [l]))).rejects.toThrow(/owner/);
    await expect(as(db, other, () => db.query(`select undo_given($1)`, [l]))).rejects.toThrow(/owner/);
  });

  it("applies only to an item marked as given", async () => {
    const l = await mkListing(db, owner);
    await expect(as(db, owner, () => db.query(`select undo_given($1)`, [l]))).rejects.toThrow(/marked as given/);
  });

  it("cannot be sidestepped by writing to the table", async () => {
    // The guard still refuses given -> accepted by hand, so the window is not optional.
    const l = await given();
    await expect(as(db, owner, () => db.query(`update listings set status = 'accepted' where id = $1`, [l])))
      .rejects.toThrow();
    expect(await status(db, l)).toBe("given");
  });

  it("does not reopen any other route out of given", async () => {
    const l = await given();
    for (const s of ["available", "closed", "requested", "lent"])
      await expect(as(db, owner, () => db.query(`update listings set status = $2 where id = $1`, [l, s])),
        `given -> ${s}`).rejects.toThrow();
  });

  it("can be marked given again after being put back", async () => {
    const l = await given();
    await as(db, owner, () => db.query(`select undo_given($1)`, [l]));
    await as(db, owner, () => db.query(`update listings set status = 'given' where id = $1`, [l]));
    expect(await status(db, l)).toBe("given");
  });
});
