import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanSearch } from "./listing";

export type Tile = { id: string; title: string; type: string; category: string; condition: string; location: string; asking_price: number | null; status: string; created_at: string; image: string | null };
export type Filters = { q?: string; category?: string; location?: string; type?: string; limit?: number };

/** How many items are available or requested right now, or null if it cannot be read. */
export async function liveCount(sb: SupabaseClient): Promise<number | null> {
  const { count } = await sb.from("public_listings").select("id", { count: "exact", head: true });
  return count;
}

/** Live listings (available or requested) from the public views, so it works signed out and signed in. */
export async function liveListings(sb: SupabaseClient, f: Filters = {}): Promise<Tile[]> {
  let query = sb.from("public_listings").select("id,title,type,category,condition,location,asking_price,status,created_at")
    .order("created_at", { ascending: false }).limit(f.limit ?? 60);
  const q = cleanSearch(f.q ?? "");
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (f.category) query = query.eq("category", f.category);
  if (f.location) query = query.eq("location", f.location);
  if (f.type) query = query.eq("type", f.type);
  const { data } = await query;
  const rows = data ?? [];
  if (!rows.length) return [];
  const { data: imgs } = await sb.from("public_listing_images").select("listing_id,storage_path,position").in("listing_id", rows.map((r) => r.id)).eq("position", 0);
  const first = new Map((imgs ?? []).map((i) => [i.listing_id as string, i.storage_path as string]));
  return rows.map((r) => ({ ...r, image: first.get(r.id) ?? null }));
}
