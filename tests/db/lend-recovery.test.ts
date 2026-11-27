import { beforeEach, describe, expect, it } from "vitest";
import { as, freshDb, mkListing, mkUser, status, type Db } from "./harness";

/**
 * A lent item that is never returned used to have no way out: from 'lent' the only legal
 * move was 'returned', the edit lock covered 'lent', and neither close_listing nor
 * fall_through applied. The owner's only exit was to claim the item came back. (0010)
 */

let db: Db, owner: string, borrower: string, other: string;

const lendAndAccept = async () => {
  const l = await mkListing(db, owner, "lend", "Drill machine");
  const r = await as(db, borrower, async () =>
    (await db.query<{ create_request: string }>(`select create_request($1, $2)`, [l, "Could I borrow it?"])).rows[0].create_request);
  await as(db, owner, () => db.query(`select accept_request($1)`, [r]));
  await as(db, owner, () => db.query(`update listings set status = 'lent' where id = $1`, [l]));
  return l;
};

beforeEach(async () => {
  db = await freshDb();
  owner = await mkUser(db, "owner@rubicotech.com");
  borrower = await mkUser(db, "borrower@rubicotech.in");
  other = await mkUser(db, "other@rubicotech.com");
});

describe("recording a loan as not returned", () => {
  it("puts the item back on the board", async () => {
    const l = await lendAndAccept();
    expect(await status(db, l)).toBe("lent");
    await as(db, owner, () => db.query(`select recover_lent($1, $2)`, [l, "Borrower left the company"]));
    expect(await status(db, l)).toBe("available");
  });

  it("keeps the note readable only by the owner", async () => {
    const l = await lendAndAccept();
    await as(db, owner, () => db.query(`select recover_lent($1, $2)`, [l, "Never came back"]));

    const mine = await as(db, owner, async () =>
      (await db.query<{ reason: string }>(`select reason from lend_recoveries`)).rows);
    expect(mine).toEqual([{ reason: "Never came back" }]);

    // The borrower it concerns cannot read it, and neither can anyone else.
    expect(await as(db, borrower, async () => (await db.query(`select reason from lend_recoveries`)).rows)).toHaveLength(0);
    expect(await as(db, other, async () => (await db.query(`select reason from lend_recoveries`)).rows)).toHaveLength(0);
  });

  it("tells the borrower the loan was closed, without the note", async () => {
    const l = await lendAndAccept();
    await as(db, owner, () => db.query(`select recover_lent($1, $2)`, [l, "Secret internal note"]));
    const seen = await as(db, borrower, async () =>
      (await db.query<{ type: string; message: string }>(`select type, message from notifications where type = 'lend_recovered'`)).rows);
    expect(seen).toHaveLength(1);
    expect(seen[0].message).not.toContain("Secret internal note");
  });

  it("releases the borrower's request so the item can be requested again", async () => {
    const l = await lendAndAccept();
    await as(db, owner, () => db.query(`select recover_lent($1, $2)`, [l, "Not returned"]));
    const { rows } = await db.query<{ status: string }>(`select status from requests where listing_id = $1`, [l]);
    expect(rows[0].status).toBe("cancelled");
    // and somebody may now ask for it
    await as(db, other, () => db.query(`select create_request($1, $2)`, [l, "Is it free now?"]));
    expect(await status(db, l)).toBe("requested");
  });

  it("only the owner can record it", async () => {
    const l = await lendAndAccept();
    await expect(as(db, borrower, () => db.query(`select recover_lent($1, $2)`, [l, "mine now"]))).rejects.toThrow(/owner/);
    await expect(as(db, other, () => db.query(`select recover_lent($1, $2)`, [l, "mine now"]))).rejects.toThrow(/owner/);
  });

  it("applies only to a lent item", async () => {
    const l = await mkListing(db, owner, "lend", "Ladder");
    await expect(as(db, owner, () => db.query(`select recover_lent($1, $2)`, [l, "x"]))).rejects.toThrow(/lent/);
  });

  it("insists on a note, so the record is worth having", async () => {
    const l = await lendAndAccept();
    await expect(as(db, owner, () => db.query(`select recover_lent($1, $2)`, [l, "   "]))).rejects.toThrow(/briefly/);
    expect(await status(db, l)).toBe("lent");
  });

  it("still refuses the moves that should stay illegal", async () => {
    const l = await lendAndAccept();
    for (const s of ["closed", "given", "requested", "accepted"])
      await expect(as(db, owner, () => db.query(`update listings set status = $2 where id = $1`, [l, s]))).rejects.toThrow();
  });

  it("nobody can write a recovery row directly", async () => {
    const l = await lendAndAccept();
    await expect(as(db, owner, () => db.query(
      `insert into lend_recoveries (listing_id, owner_id, reason) values ($1, $2, 'direct')`, [l, owner]))).rejects.toThrow();
  });
});
