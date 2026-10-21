"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { validateWanted, type WantedInput } from "@/lib/listing";
import { flushOutbox } from "@/lib/outbox";
import { supabaseServer } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

export async function createWanted(input: WantedInput): Promise<{ error?: string }> {
  const err = validateWanted(input);
  if (err) return { error: err };
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const { error } = await sb.from("wanted_posts").insert({
    poster_id: user.id, title: input.title.trim(), description: input.description.trim(), category: input.category, location: input.location,
  });
  revalidatePath("/wanted");
  return error ? { error: "Could not post. Complete your profile (city and Teams handle) first." } : {};
}

export async function respondWanted(id: string, note: string): Promise<{ error?: string }> {
  if (!UUID.test(id)) return { error: "Not found." };
  const { error } = await (await supabaseServer()).rpc("respond_wanted", { p_wanted: id, p_note: note });
  after(flushOutbox);
  revalidatePath("/wanted");
  return error ? { error: error.message } : {};
}

export async function markFulfilled(id: string) {
  if (!UUID.test(id)) return;
  await (await supabaseServer()).from("wanted_posts").update({ status: "fulfilled" }).eq("id", id).eq("status", "open");
  revalidatePath("/wanted");
}
