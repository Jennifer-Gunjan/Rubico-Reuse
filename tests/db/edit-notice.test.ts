import { beforeEach, describe, expect, it } from "vitest";
import { as, freshDb, mkListing, mkUser, type Db } from "./harness";

/**
 * The edit lock covers 'accepted', 'lent' and 'given', but not 'requested', so an owner can
 * change an item after colleagues have asked for it. Editing then is legitimate - a typo, a
 * corrected condition - so the rule is that waiting colleagues are told, not that the owner
 * is blocked. (0011)
 */

let db: Db, owner: string, alice: string, bob: string;

const noticesFor = (uid: string) =>
  as(db, uid, async () =>
    (await db.query<{ message: string }>(
      `select message from notifications where type = 'listing_edited' order by created_at`)).rows);

const requested = async () => {
  const l = await mkListing(db, owner, "sell", "Office chair");
  await as(db, alice, () => db.query(`select create_request($1, $2)`, [l, "Could I have it?"]));
  return l;
};

beforeEach(async () => {
  db = await freshDb();
  owner = await mkUser(db, "owner@rubicotech.com");
  alice = await mkUser(db, "alice@rubicotech.in");
  bob = await mkUser(db, "bob@rubicotech.com");
});

describe("telling people when an item they asked for changes", () => {
  it("names the new price, which is the change most likely to matter", async () => {
    const l = await requested();
    await as(db, owner, () => db.query(`update listings set asking_price = 2000 where id = $1`, [l]));
    const seen = await noticesFor(alice);
    expect(seen).toHaveLength(1);
    expect(seen[0].message).toContain("₹2000.00");
  });

  it("says what changed rather than only that something did", async () => {
    const l = await requested();
    await as(db, owner, () => db.query(`update listings set title = 'Different chair' where id = $1`, [l]));
    expect((await noticesFor(alice))[0].message).toContain("the title changed");
  });

  it("tells everyone still waiting, not only the first", async () => {
    const l = await requested();
    await as(db, bob, () => db.query(`select create_request($1, $2)`, [l, "Me too"]));
    await as(db, owner, () => db.query(`update listings set description = 'Now with a cushion' where id = $1`, [l]));
    expect(await noticesFor(alice)).toHaveLength(1);
    expect(await noticesFor(bob)).toHaveLength(1);
  });

  it("stays quiet when nothing a requester would care about changed", async () => {
    const l = await requested();
    // updated_at always moves; that alone must not send anything.
    await as(db, owner, () => db.query(`update listings set title = title where id = $1`, [l]));
    expect(await noticesFor(alice)).toHaveLength(0);
  });

  it("stays quiet when nobody is waiting", async () => {
    const l = await mkListing(db, owner, "sell", "Desk lamp");
    await as(db, owner, () => db.query(`update listings set asking_price = 99 where id = $1`, [l]));
    const all = await db.query(`select id from notifications where type = 'listing_edited'`);
    expect(all.rows).toHaveLength(0);
  });

  it("does not fire on the status changes that drive the workflow", async () => {
    const l = await requested();
    const { rows: [r] } = await db.query<{ id: string }>(`select id from requests where listing_id = $1`, [l]);
    await as(db, owner, () => db.query(`select accept_request($1)`, [r.id]));
    // Accepting changes status, not the item itself; alice already hears about that separately.
    expect(await noticesFor(alice)).toHaveLength(0);
  });

  it("does not tell someone whose request is no longer pending", async () => {
    const l = await requested();
    await as(db, bob, () => db.query(`select create_request($1, $2)`, [l, "Me too"]));
    const { rows: [r] } = await db.query<{ id: string }>(
      `select id from requests where listing_id = $1 and seeker_id = $2`, [l, bob]);
    await as(db, owner, () => db.query(`select reject_request($1)`, [r.id]));
    await as(db, owner, () => db.query(`update listings set description = 'Updated' where id = $1`, [l]));
    expect(await noticesFor(alice)).toHaveLength(1);
    expect(await noticesFor(bob)).toHaveLength(0);
  });
});
