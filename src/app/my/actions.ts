"use server";
import { revalidatePath } from "next/cache";
import { validateListing, type ListingInput } from "@/lib/listing";
import { supabaseServer } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

export async function closeListing(id: string) {
  if (!UUID.test(id)) return;
  await (await supabaseServer()).rpc("close_listing", { p_listing: id });
  revalidatePath("/my");
}

export async function reopenListing(id: string) {
  if (!UUID.test(id)) return;
  await (await supabaseServer()).from("listings").update({ status: "available" }).eq("id", id).eq("status", "closed");
  revalidatePath("/my");
}

export async function updateListing(id: string, input: ListingInput): Promise<{ error?: string }> {
  if (!UUID.test(id)) return { error: "Listing not found." };
  const err = validateListing(input);
  if (err) return { error: err };
  const sell = input.type === "sell";
  const { error } = await (await supabaseServer()).from("listings").update({
    title: input.title.trim(), description: input.description.trim(),
    category: input.category, condition: input.condition, location: input.location,
    asking_price: sell ? Number(input.asking_price) : null,
    negotiable: sell ? !!input.negotiable : false,
    wanted_in_return: input.type === "exchange" ? input.wanted_in_return?.trim() || null : null,
    lend_duration_text: input.type === "lend" ? input.lend_duration_text?.trim() || null : null,
  }).eq("id", id);
  if (error) return { error: "This listing cannot be edited right now (it may already be accepted or given)." };
  return {};
}
