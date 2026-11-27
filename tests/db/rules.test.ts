import { beforeEach, describe, expect, it } from "vitest";
import { as, freshDb, mkListing, mkUser, status, type Db } from "./harness";

let db: Db, owner: string, alice: string, bob: string;

const request = (uid: string, listing: string, msg = "I would love this") =>
  as(db, uid, async () =>
    (await db.query<{ create_request: string }>(`select create_request($1, $2)`, [listing, msg])).rows[0].create_request);
const call = (uid: string, fn: string, arg: string) => as(db, uid, () => db.query(`select ${fn}($1)`, [arg]));
const cardsOf = (viewer: string, target: string) =>
  as(db, viewer, async () => (await db.query(`select email, teams_handle from profiles where id = $1`, [target])).rows);
const reqStatus = async (id: string) =>
  (await db.query<{ status: string }>(`select status from requests where id = $1`, [id])).rows[0].status;

beforeEach(async () => {
  db = await freshDb();
  owner = await mkUser(db, "owner@rubicotech.com");
  alice = await mkUser(db, "alice@rubicotech.in");
  bob = await mkUser(db, "bob@rubicotech.com");
});

describe("highest-risk rules", () => {
  it("1. only one request can win an accept", async () => {
    const l = await mkListing(db, owner);
    const ra = await request(alice, l);
    const rb = await request(bob, l);
    expect(await status(db, l)).toBe("requested");

    await call(owner, "accept_request", ra);
    await expect(call(owner, "accept_request", rb)).rejects.toThrow();

    expect(await reqStatus(ra)).toBe("accepted");
    expect(await reqStatus(rb)).toBe("rejected");
    expect(await status(db, l)).toBe("accepted");
    // backstop: even a direct write cannot create a second accepted request
    await expect(db.query(`update requests set status = 'accepted' where id = $1`, [rb])).rejects.toThrow();
  });

  it("2. contact details stay hidden until accept, and only for the two parties", async () => {
    const l = await mkListing(db, owner);
    const ra = await request(alice, l);
    await request(bob, l);

    expect(await cardsOf(alice, owner)).toHaveLength(0);
    expect(await cardsOf(owner, alice)).toHaveLength(0);

    await call(owner, "accept_request", ra);
    expect(await cardsOf(alice, owner)).toEqual([{ email: "owner@rubicotech.com", teams_handle: "@owner" }]);
    expect(await cardsOf(owner, alice)).toHaveLength(1);
    expect(await cardsOf(bob, owner)).toHaveLength(0); // auto-rejected seeker sees nothing
    expect(await cardsOf(bob, alice)).toHaveLength(0);
  });

  it("3. an outside domain cannot have an account", async () => {
    await expect(db.query(`insert into auth.users (email) values ('x@gmail.com')`)).rejects.toThrow(/Rubico/);
    await expect(db.query(`insert into auth.users (email) values ('x@rubicotech.com.evil.com')`)).rejects.toThrow();
  });

  it("4. nobody else can edit, close or accept on someone's listing", async () => {
    const l = await mkListing(db, owner);
    const ra = await request(alice, l);

    const edited = await as(db, bob, () => db.query(`update listings set title = 'hijacked' where id = $1`, [l]));
    expect(edited.affectedRows).toBe(0);
    await expect(call(bob, "close_listing", l)).rejects.toThrow(/owner/);
    await expect(call(bob, "accept_request", ra)).rejects.toThrow(/owner/);
    await expect(call(alice, "accept_request", ra)).rejects.toThrow(/owner/);
  });

  it("5. fall through hides contact, allows a fresh request, keeps rejected seekers rejected", async () => {
    const l = await mkListing(db, owner);
    const ra = await request(alice, l);
    const rb = await request(bob, l);
    await call(owner, "accept_request", ra);

    await call(owner, "fall_through", l);
    expect(await status(db, l)).toBe("available");
    expect(await reqStatus(ra)).toBe("cancelled");
    expect(await reqStatus(rb)).toBe("rejected");
    expect(await cardsOf(alice, owner)).toHaveLength(0);

    await request(alice, l, "Still interested"); // the same seeker may try again
    expect(await status(db, l)).toBe("requested");
  });
});

describe("request rules", () => {
  it("blocks self-request and duplicate active requests", async () => {
    const l = await mkListing(db, owner);
    await expect(request(owner, l)).rejects.toThrow(/own listing/);
    await request(alice, l);
    await expect(request(alice, l)).rejects.toThrow(/already have an active request/);
  });

  it("needs a complete profile before requesting or posting", async () => {
    const carol = (await db.query<{ id: string }>(
      `insert into auth.users (email) values ('carol@rubicotech.in') returning id`)).rows[0].id;
    const l = await mkListing(db, owner);
    await expect(request(carol, l)).rejects.toThrow(/profile/);
    await expect(as(db, carol, () => db.query(
      `insert into listings (owner_id, title, description, category, condition, type, location)
       values ($1, 'Chair', 'x', 'Furniture', 'good', 'donate', 'Haridwar')`, [carol]))).rejects.toThrow();
  });

  it("withdraw or reject of the last pending request returns the listing to Available", async () => {
    const l = await mkListing(db, owner);
    const ra = await request(alice, l);
    const rb = await request(bob, l);
    await call(alice, "withdraw_request", ra);
    expect(await status(db, l)).toBe("requested");
    await call(owner, "reject_request", rb);
    expect(await status(db, l)).toBe("available");
  });

  it("closing rejects pending requests and notifies the seekers", async () => {
    const l = await mkListing(db, owner);
    const ra = await request(alice, l);
    await call(owner, "close_listing", l);
    expect(await status(db, l)).toBe("closed");
    expect(await reqStatus(ra)).toBe("rejected");
    const n = await as(db, alice, async () => (await db.query<{ type: string }>(`select type from notifications`)).rows);
    expect(n.map((r: { type: string }) => r.type)).toContain("listing_closed");
  });

  it("notifies only the right person", async () => {
    const l = await mkListing(db, owner);
    await request(alice, l);
    const ownerSees = await as(db, owner, async () => (await db.query(`select type from notifications`)).rows);
    const bobSees = await as(db, bob, async () => (await db.query(`select type from notifications`)).rows);
    expect(ownerSees).toEqual([{ type: "new_request" }]);
    expect(bobSees).toHaveLength(0);
  });
});

describe("lifecycle guards", () => {
  it("a giver cannot set request-driven statuses by hand", async () => {
    const l = await mkListing(db, owner);
    for (const s of ["accepted", "requested", "given", "closed"])
      await expect(as(db, owner, () => db.query(`update listings set status = $2 where id = $1`, [l, s]))).rejects.toThrow();
  });

  it("locks edits while Accepted", async () => {
    const l = await mkListing(db, owner);
    const ra = await request(alice, l);
    await call(owner, "accept_request", ra);
    await expect(as(db, owner, () => db.query(`update listings set title = 'New title' where id = $1`, [l]))).rejects.toThrow(/cannot be edited/);
  });

  it("donate: Accepted then Given is final", async () => {
    const l = await mkListing(db, owner);
    await call(owner, "accept_request", await request(alice, l));
    await as(db, owner, () => db.query(`update listings set status = 'given' where id = $1`, [l]));
    expect(await status(db, l)).toBe("given");
    await expect(as(db, owner, () => db.query(`update listings set status = 'available' where id = $1`, [l]))).rejects.toThrow();
  });

  it("lend: Lent, Returned, Available; Given is not allowed", async () => {
    const l = await mkListing(db, owner, "lend", "Drill machine");
    await call(owner, "accept_request", await request(alice, l));
    await expect(as(db, owner, () => db.query(`update listings set status = 'given' where id = $1`, [l]))).rejects.toThrow();
    for (const s of ["lent", "returned", "available"]) {
      await as(db, owner, () => db.query(`update listings set status = $2 where id = $1`, [l, s]));
      expect(await status(db, l)).toBe(s);
    }
  });

  it("closed listings can be reopened by the owner", async () => {
    const l = await mkListing(db, owner);
    await call(owner, "close_listing", l);
    await as(db, owner, () => db.query(`update listings set status = 'available' where id = $1`, [l]));
    expect(await status(db, l)).toBe("available");
  });
});

describe("wanted board and profiles", () => {
  it("responds once, never to your own post, and notifies the poster", async () => {
    const w = (await as(db, owner, () => db.query<{ id: string }>(
      `insert into wanted_posts (poster_id, title, description, category, location)
       values ($1, 'Need a ladder', 'Any size', 'Home and garden', 'Dehradun') returning id`, [owner]))).rows[0].id;
    await expect(call(owner, "respond_wanted", w)).rejects.toThrow(/own post/);
    await call(alice, "respond_wanted", w);
    await expect(call(alice, "respond_wanted", w)).rejects.toThrow(/already responded/);
    const n = await as(db, owner, async () => (await db.query(`select type from notifications`)).rows);
    expect(n).toEqual([{ type: "wanted_response" }]);
  });

  it("users cannot change their email", async () => {
    await expect(as(db, alice, () => db.query(`update profiles set email = 'a@rubicotech.in' where id = $1`, [alice]))).rejects.toThrow();
  });
  it("has no privilege column to escalate into", async () => {
    // 0008 dropped `role`. Previously a user was blocked from setting it by a column grant;
    // now there is nothing to set, which is a stronger guarantee than a denied update.
    const { rows } = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles'`);
    expect(rows.map((r) => r.column_name)).not.toContain("role");
  });
  it("owner can edit while Available; type and owner can never change", async () => {
    const l = await mkListing(db, owner);
    await as(db, owner, () => db.query(`update listings set title = 'Better title' where id = $1`, [l]));
    await expect(as(db, owner, () => db.query(`update listings set type = 'sell', asking_price = 10 where id = $1`, [l]))).rejects.toThrow();
    await expect(as(db, owner, () => db.query(`update listings set owner_id = $2 where id = $1`, [l, alice]))).rejects.toThrow();
  });
  it("wanted poster sees a responder's contact; nobody else does", async () => {
    const { rows: [{ id: w }] } = await db.query<{ id: string }>(
      `insert into wanted_posts (poster_id, title, description, category, location)
       values ($1, 'Need a desk', 'Study desk', 'Furniture', 'Dehradun') returning id`, [owner]);
    await call(alice, "respond_wanted", w);
    const seen = (viewer: string, target: string) => cardsOf(viewer, target);
    expect((await seen(owner, alice)).length).toBe(1);   // poster sees the responder
    expect((await seen(bob, alice)).length).toBe(0);     // an unrelated user does not
    expect((await seen(alice, owner)).length).toBe(0);   // the responder does not see the poster
  });
});
