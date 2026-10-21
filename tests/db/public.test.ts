import { beforeEach, describe, expect, it } from "vitest";
import { freshDb, mkListing, mkUser, type Db } from "./harness";

let db: Db, owner: string;

/** Run as the signed-out role. */
const anon = async <T>(fn: () => Promise<T>) => {
  await db.exec(`set role anon`);
  try { return await fn(); } finally { await db.exec(`reset role`); }
};

beforeEach(async () => {
  db = await freshDb();
  owner = await mkUser(db, "owner@rubicotech.com");
}, 30000);

describe("public preview views", () => {
  it("signed-out visitors see live listings only, without giver identity", async () => {
    const live = await mkListing(db, owner, "donate", "Visible desk");
    const closed = await mkListing(db, owner, "donate", "Closed desk");
    await db.exec(`select set_config('reuse.system', 'on', false); update listings set status = 'closed' where id = '${closed}'; select set_config('reuse.system', 'off', false);`);
    const rows = await anon(async () => (await db.query<Record<string, unknown>>(`select * from public_listings`)).rows);
    expect(rows.map((r) => r.id)).toEqual([live]);
    expect(Object.keys(rows[0])).not.toContain("owner_id");
  }, 30000);

  it("signed-out visitors cannot read the real tables or change anything", async () => {
    const id = await mkListing(db, owner);
    await expect(anon(() => db.query(`select * from listings`))).rejects.toThrow(/permission denied/);
    await expect(anon(() => db.query(`select * from profiles`))).rejects.toThrow(/permission denied/);
    await expect(anon(() => db.query(`select * from requests`))).rejects.toThrow(/permission denied/);
    await expect(anon(() => db.query(`update public_listings set title = 'hacked' where id = $1`, [id]))).rejects.toThrow(/permission denied/);
    await expect(anon(() => db.query(`delete from public_listings where id = $1`, [id]))).rejects.toThrow(/permission denied/);
    expect((await db.query<{ title: string }>(`select title from listings where id = $1`, [id])).rows[0].title).toBe("Study table");
  }, 30000);

  it("signed-out visitors cannot call request or notification functions", async () => {
    const id = await mkListing(db, owner);
    await expect(anon(() => db.query(`select create_request($1, 'hi')`, [id]))).rejects.toThrow(/permission denied/);
  }, 30000);
});
