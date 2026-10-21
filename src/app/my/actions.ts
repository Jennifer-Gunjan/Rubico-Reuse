"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { flushOutbox } from "@/lib/outbox";
import { validateListing, type ListingInput } from "@/lib/listing";
import { supabaseServer } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

export async function closeListing(id: string): Promise<{ error?: string }> {
  if (!UUID.test(id)) return { error: "Listing not found." };
  const { error } = await (await supabaseServer()).rpc("close_listing", { p_listing: id });
  after(flushOutbox);
  revalidatePath("/my");
  return error ? { error: error.message || "Could not close this listing. Please try again." } : {};
}

export async function reopenListing(id: string): Promise<{ error?: string }> {
  if (!UUID.test(id)) return { error: "Listing not found." };
  const { data, error } = await (await supabaseServer()).from("listings").update({ status: "available" }).eq("id", id).eq("status", "closed").select("id");
  revalidatePath("/my");
  return error || !data?.length ? { error: "Could not relist this item. Please try again." } : {};
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
