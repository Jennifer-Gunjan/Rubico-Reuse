import type { SupabaseClient } from "@supabase/supabase-js";

export const photoUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/${path}`;

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const okPhoto = (f: File) => ["image/jpeg", "image/png"].includes(f.type) && f.size <= MAX_PHOTO_BYTES;
export const extFor = (f: File) => (f.type === "image/png" ? "png" : "jpg");

/** Uploads one photo and records it. Returns false (and removes the stray file) if either step fails. */
export async function uploadPhoto(sb: SupabaseClient, path: string, file: File, listingId: string, position: number): Promise<boolean> {
  const up = await sb.storage.from("listing-images").upload(path, file, { contentType: file.type });
  if (up.error) return false;
  const ins = await sb.from("listing_images").insert({ listing_id: listingId, storage_path: path, position });
  if (ins.error) { await sb.storage.from("listing-images").remove([path]); return false; }
  return true;
}
