import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanSearch } from "./listing";

export type Tile = { id: string; title: string; type: string; category: string; condition: string; location: string; asking_price: number | null; status: string; created_at: string; image: string | null };
export type Sort = "new" | "old";
export type Filters = { q?: string; category?: string; location?: string; type?: string; sort?: Sort; page?: number; limit?: number };

/** How many items a Browse page shows before it offers the next one. */
export const PAGE_SIZE = 24;

export const SORTS: Record<Sort, string> = { new: "Newest first", old: "Oldest first" };

/** Only the orders the control offers, so a bad URL sorts normally instead of erroring. */
export const cleanSort = (v: string | undefined): Sort => (v === "old" ? "old" : "new");

/** 1-based, so a bad or missing page lands on the first one rather than an empty grid. */
export function cleanPage(v: string | undefined): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/**
 * The predicates both reads below must apply. Returned as plain data rather than applied
 * through a generic helper, so the grid and the count can never drift apart and the rule
 * stays readable on its own.
 */
export function narrowing(f: Filters): { or?: string; eq: [string, string][] } {
  const q = cleanSearch(f.q ?? "");
  const eq: [string, string][] = [];
  if (f.category) eq.push(["category", f.category]);
  if (f.location) eq.push(["location", f.location]);
  if (f.type) eq.push(["type", f.type]);
  return { or: q ? `title.ilike.%${q}%,description.ilike.%${q}%` : undefined, eq };
}

/** How many items are available or requested right now, or null if it cannot be read. */
export async function liveCount(sb: SupabaseClient): Promise<number | null> {
  const { count } = await sb.from("public_listings").select("id", { count: "exact", head: true });
  return count;
}

/** How many items match these filters. Drives the result count and the page links. */
export async function countListings(sb: SupabaseClient, f: Filters = {}): Promise<number | null> {
  const n = narrowing(f);
  let query = sb.from("public_listings").select("id", { count: "exact", head: true });
  if (n.or) query = query.or(n.or);
  for (const [c, v] of n.eq) query = query.eq(c, v);
  const { count } = await query;
  return count;
}

/** Live listings (available or requested) from the public views, so it works signed out and signed in. */
export async function liveListings(sb: SupabaseClient, f: Filters = {}): Promise<Tile[]> {
  const size = f.limit ?? PAGE_SIZE;
  const from = (Math.max(1, f.page ?? 1) - 1) * size;
  const n = narrowing(f);
  let query = sb.from("public_listings").select("id,title,type,category,condition,location,asking_price,status,created_at")
    .order("created_at", { ascending: f.sort === "old" })
    .range(from, from + size - 1);
  if (n.or) query = query.or(n.or);
  for (const [c, v] of n.eq) query = query.eq(c, v);
  const { data } = await query;
  const rows = data ?? [];
  if (!rows.length) return [];

  // The cover is the lowest-numbered photo, not necessarily slot 0. Removing the first
  // photo of two leaves the survivor in slot 1 and nothing renumbers it, so matching
  // position 0 exactly made a listing that still has a photo look like it has none.
  const { data: imgs } = await sb.from("public_listing_images")
    .select("listing_id,storage_path,position")
    .in("listing_id", rows.map((r) => r.id))
    .order("position");
  const cover = new Map<string, string>();
  for (const i of imgs ?? []) {
    const id = i.listing_id as string;
    if (!cover.has(id)) cover.set(id, i.storage_path as string);
  }
  return rows.map((r) => ({ ...r, image: cover.get(r.id) ?? null }));
}
