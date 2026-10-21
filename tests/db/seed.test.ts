import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { freshDb, mkUser } from "./harness";

const sql = (f: string) => readFileSync(join(__dirname, "../../supabase", f), "utf8");
const count = async (db: Awaited<ReturnType<typeof freshDb>>, t: string) =>
  Number((await db.query<{ n: string }>(`select count(*) n from ${t} where description like '%[demo]'`)).rows[0].n);

it("seed.sql inserts demo data that seed_remove.sql fully removes", async () => {
  const db = await freshDb();
  await mkUser(db, "jennifer.gunjan@rubicotech.in");
  await db.exec(sql("seed.sql"));
  expect(await count(db, "listings")).toBe(12);
  expect(await count(db, "wanted_posts")).toBe(3);
  await db.exec(sql("seed_remove.sql"));
  expect(await count(db, "listings")).toBe(0);
  expect(await count(db, "wanted_posts")).toBe(0);
}, 30000);

it("seed.sql refuses to run for an unknown email", async () => {
  const db = await freshDb();
  await expect(db.exec(sql("seed.sql"))).rejects.toThrow(/No profile/);
});
