// Needs a REAL Postgres (PGlite has one connection, so it cannot race). Set CONCURRENCY_DATABASE_URL to an empty scratch database:
// this test DROPS its public, auth and storage schemas. Skipped when the variable is not set.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SUPABASE_STUB } from "../db/harness";

const url = process.env.CONCURRENCY_DATABASE_URL;

describe.skipIf(!url)("races on a real Postgres", () => {
  let pool: pg.Pool, n = 0;

  const q = async <T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, args: unknown[] = []) => (await pool.query<T>(sql, args)).rows;

  /** One signed-in user's transaction. Callers start several together with Promise.all. */
  async function asUser<T>(uid: string, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
      const out = await fn(c);
      await c.query("commit");
      return out;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  }
  const call = (uid: string, fn: string, arg: string) => asUser(uid, (c) => c.query(`select ${fn}($1)`, [arg]));
  const request = (uid: string, listing: string) =>
    asUser(uid, async (c) => (await c.query<{ create_request: string }>(`select create_request($1, 'please')`, [listing])).rows[0].create_request);

  async function user(name: string) {
    const email = `${name}${++n}@rubicotech.com`;
    const [{ id }] = await q<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email]);
    // teams_handle is an address since 0015, so store the sign-in address rather than the name.
    await q(`update profiles set name = $2, location = 'Haridwar', teams_handle = $3 where id = $1`, [id, name, email]);
    return id;
  }
  async function listing(owner: string) {
    const [{ id }] = await q<{ id: string }>(
      `insert into listings (owner_id, title, description, category, condition, type, location)
       values ($1, 'Desk', 'Solid', 'Furniture', 'good', 'donate', 'Haridwar') returning id`, [owner]);
    return id;
  }
  const statusOf = async (l: string) => (await q<{ status: string }>(`select status from listings where id = $1`, [l]))[0].status;
  const accepted = async (l: string) => Number((await q<{ c: string }>(`select count(*) c from requests where listing_id = $1 and status = 'accepted'`, [l]))[0].c);

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url, max: 10 });
    await q(`drop schema if exists public cascade; create schema public; drop schema if exists auth cascade; drop schema if exists storage cascade;`);
    await q(SUPABASE_STUB);
    await q(`grant usage on schema public to anon, authenticated`);
    const dir = join(__dirname, "../../supabase/migrations");
    for (const f of readdirSync(dir).sort()) await q(readFileSync(join(dir, f), "utf8"));
  }, 60000);
  afterAll(async () => { await pool?.end(); });

  it("two accepts at the same moment: exactly one wins (25 rounds)", async () => {
    for (let round = 0; round < 25; round++) {
      const owner = await user("owner"), a = await user("asha"), b = await user("bala");
      const l = await listing(owner);
      const [ra, rb] = await Promise.all([request(a, l), request(b, l)]);
      const results = await Promise.allSettled([call(owner, "accept_request", ra), call(owner, "accept_request", rb)]);
      expect(results.filter((r) => r.status === "fulfilled").length, `round ${round}`).toBe(1);
      expect(await accepted(l)).toBe(1);
      expect(await statusOf(l)).toBe("accepted");
    }
  }, 120000);

  it("accept racing close never leaves an accepted request on a closed listing (25 rounds)", async () => {
    for (let round = 0; round < 25; round++) {
      const owner = await user("owner"), a = await user("asha");
      const l = await listing(owner);
      const r = await request(a, l);
      await Promise.allSettled([call(owner, "accept_request", r), call(owner, "close_listing", l)]);
      const s = await statusOf(l);
      expect(["accepted", "closed"], `round ${round}`).toContain(s);
      expect(await accepted(l)).toBe(s === "accepted" ? 1 : 0);
    }
  }, 120000);

  it("accept racing withdraw of the same request ends in one consistent state (25 rounds)", async () => {
    for (let round = 0; round < 25; round++) {
      const owner = await user("owner"), a = await user("asha");
      const l = await listing(owner);
      const r = await request(a, l);
      await Promise.allSettled([call(owner, "accept_request", r), call(a, "withdraw_request", r)]);
      const [{ status }] = await q<{ status: string }>(`select status from requests where id = $1`, [r]);
      expect(["accepted", "withdrawn"], `round ${round}`).toContain(status);
      expect(await statusOf(l)).toBe(status === "accepted" ? "accepted" : "available");
    }
  }, 120000);

  it("a double-click request by one seeker creates exactly one request", async () => {
    const owner = await user("owner"), a = await user("asha");
    const l = await listing(owner);
    const results = await Promise.allSettled([request(a, l), request(a, l), request(a, l)]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    expect((await q(`select 1 from requests where listing_id = $1`, [l])).length).toBe(1);
  });
});
