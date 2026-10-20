"use server";
import { validateListing, type ListingInput } from "@/lib/listing";
import { supabaseServer } from "@/lib/supabase/server";

export async function createListing(input: ListingInput): Promise<{ id?: string; error?: string }> {
  const err = validateListing(input);
  if (err) return { error: err };
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const sell = input.type === "sell";
  const { data, error } = await sb.from("listings").insert({
    owner_id: user.id,
    title: input.title.trim(), description: input.description.trim(),
    category: input.category, condition: input.condition, type: input.type, location: input.location,
    asking_price: sell ? Number(input.asking_price) : null,
    negotiable: sell ? !!input.negotiable : false,
    wanted_in_return: input.type === "exchange" ? input.wanted_in_return?.trim() || null : null,
    lend_duration_text: input.type === "lend" ? input.lend_duration_text?.trim() || null : null,
  }).select("id").single();
  if (error) return { error: "Could not post. Complete your profile (city and Teams handle) first." };
  return { id: data.id };
}
