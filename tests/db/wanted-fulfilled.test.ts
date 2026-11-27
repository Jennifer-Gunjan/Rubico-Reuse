import { beforeEach, describe, expect, it } from "vitest";
import { as, freshDb, mkUser, type Db } from "./harness";

/**
 * Answering "I have this" used to end in silence. Marking a wanted post fulfilled was a bare
 * status flag with no notification to anyone who had responded - not even "someone else
 * provided it". The listings side notifies at every step; the wanted board notified nobody
 * outward. For a feature where colleagues go out of their way to help, that is the surest
 * way to stop them bothering. (0013)
 */

let db: Db, poster: string, alice: string, bob: string;

const mkWanted = async (uid: string, title = "Need a desk") =>
  (await as(db, uid, () => db.query<{ id: string }>(
    `insert into wanted_posts (poster_id, title, description, category, location)
     values ($1, $2, 'A study desk', 'Furniture', 'Dehradun') returning id`, [uid, title])
  )).rows[0].id;

const noticesFor = (uid: string) =>
  as(db, uid, async () => (await db.query<{ message: string }>(
    `select message from notifications where type = 'wanted_fulfilled'`)).rows);

beforeEach(async () => {
  db = await freshDb();
  poster = await mkUser(db, "poster@rubicotech.com");
  alice = await mkUser(db, "alice@rubicotech.in");
  bob = await mkUser(db, "bob@rubicotech.com");
});

describe("telling responders a wanted post was fulfilled", () => {
  it("tells everyone who offered, not only the one who was taken up", async () => {
    const w = await mkWanted(poster);
    await as(db, alice, () => db.query(`select respond_wanted($1, $2)`, [w, "I have one"]));
    await as(db, bob, () => db.query(`select respond_wanted($1, $2)`, [w, "So do I"]));

    await as(db, poster, () => db.query(`update wanted_posts set status = 'fulfilled' where id = $1`, [w]));

    expect(await noticesFor(alice)).toHaveLength(1);
    expect(await noticesFor(bob)).toHaveLength(1);
  });

  it("names the item so the notice makes sense on its own", async () => {
    const w = await mkWanted(poster, "Need a monitor stand");
    await as(db, alice, () => db.query(`select respond_wanted($1, $2)`, [w, "Got one"]));
    await as(db, poster, () => db.query(`update wanted_posts set status = 'fulfilled' where id = $1`, [w]));
    expect((await noticesFor(alice))[0].message).toContain("Need a monitor stand");
  });

  it("stays quiet when nobody responded", async () => {
    const w = await mkWanted(poster);
    await as(db, poster, () => db.query(`update wanted_posts set status = 'fulfilled' where id = $1`, [w]));
    expect((await db.query(`select id from notifications where type = 'wanted_fulfilled'`)).rows).toHaveLength(0);
  });

  it("fires however the status is set, not only through the app", async () => {
    // `authenticated` holds grant update (status) on wanted_posts, so the app is not the
    // only path. A trigger is what makes the rule hold for a direct write too.
    const w = await mkWanted(poster);
    await as(db, alice, () => db.query(`select respond_wanted($1, $2)`, [w, "Here"]));
    await as(db, poster, () => db.query(`update wanted_posts set status = 'fulfilled' where id = $1`, [w]));
    expect(await noticesFor(alice)).toHaveLength(1);
  });

  it("does not fire again if the row is written a second time", async () => {
    const w = await mkWanted(poster);
    await as(db, alice, () => db.query(`select respond_wanted($1, $2)`, [w, "Here"]));
    await as(db, poster, () => db.query(`update wanted_posts set status = 'fulfilled' where id = $1`, [w]));
    await as(db, poster, () => db.query(`update wanted_posts set status = 'fulfilled' where id = $1`, [w]));
    expect(await noticesFor(alice)).toHaveLength(1);
  });

  it("does not tell a responder about somebody else's post", async () => {
    const mine = await mkWanted(poster, "Need a desk");
    const theirs = await mkWanted(bob, "Need a lamp");
    await as(db, alice, () => db.query(`select respond_wanted($1, $2)`, [mine, "Here"]));
    await as(db, bob, () => db.query(`update wanted_posts set status = 'fulfilled' where id = $1`, [theirs]));
    expect(await noticesFor(alice)).toHaveLength(0);
  });
});
