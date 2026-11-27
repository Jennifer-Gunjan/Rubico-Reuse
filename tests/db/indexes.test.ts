import { beforeAll, describe, expect, it } from "vitest";
import { freshDb, type Db } from "./harness";

/**
 * The indexes added in 0007 are invisible in behaviour, so nothing else in the suite would
 * notice if one were dropped or renamed. These tests pin them down by the read they serve,
 * and assert the property that makes each one necessary.
 *
 * Plan shape is deliberately not asserted: PGlite holds a handful of rows, where a sequential
 * scan is genuinely the cheaper plan, so an EXPLAIN assertion here would test the planner's
 * row-count heuristics rather than the schema. The measured plans are in the pull request.
 */

type Idx = { indexname: string; indexdef: string };

describe("query indexes (0007)", () => {
  let db: Db, idx: Idx[];

  beforeAll(async () => {
    db = await freshDb();
    const { rows } = await db.query<Idx>(
      `select indexname, indexdef from pg_indexes where schemaname = 'public'`);
    idx = rows;
  });

  const find = (name: string) => idx.find((i) => i.indexname === name);

  it("indexes requests.listing_id for reads of every status", () => {
    const i = find("requests_listing");
    expect(i, "the listing page reads requests of all statuses").toBeDefined();
    // The pre-existing indexes on this column are partial, which is why they cannot serve it.
    expect(i!.indexdef.toLowerCase()).not.toContain("where");
  });

  it("keeps the partial uniqueness rules that enforce one winner", () => {
    // 0007 must not have replaced these: they are business rules, not performance aids.
    expect(find("requests_one_active")?.indexdef.toLowerCase()).toContain("where");
    expect(find("requests_one_accepted")?.indexdef.toLowerCase()).toContain("where");
  });

  it("indexes the Browse read with a predicate matching the public view", () => {
    const i = find("listings_live_created");
    expect(i, "Browse orders live listings by date").toBeDefined();
    const def = i!.indexdef.toLowerCase();
    // Must be partial and ordered, or Postgres still cannot avoid the sort.
    expect(def).toContain("where");
    expect(def).toContain("available");
    expect(def).toContain("requested");
    expect(def).toContain("desc");
  });

  it("gives every foreign key a leading index, so deleting a leaver does not scan", async () => {
    const { rows } = await db.query<{ child: string; col: string }>(`
      select c.conrelid::regclass::text as child, a.attname as col
      from pg_constraint c
      join unnest(c.conkey) k(attnum) on true
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
      where c.contype = 'f' and c.connamespace = 'public'::regnamespace
        and not exists (
          select 1 from pg_index i
          where i.indrelid = c.conrelid and i.indkey[0] = a.attnum
        )`);
    expect(rows, `foreign keys still without a leading index: ${rows.map((r) => `${r.child}.${r.col}`).join(", ")}`)
      .toEqual([]);
  });
});
