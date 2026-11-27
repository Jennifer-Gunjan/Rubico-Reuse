"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { flushOutbox, sendReport } from "@/lib/outbox";
import { supabaseServer } from "@/lib/supabase/server";

type R = { error?: string };
const UUID = /^[0-9a-f-]{36}$/i;
const nice = (m?: string) => m || "Something went wrong. Please try again.";

async function rpc(fn: string, args: Record<string, unknown>, listing: string): Promise<R> {
  if (fn !== "create_request" && Object.values(args).some((v) => typeof v === "string" && !UUID.test(v))) return { error: "Not found." };
  const { error } = await (await supabaseServer()).rpc(fn, args);
  revalidatePath(`/listings/${listing}`);
  after(flushOutbox);
  return error ? { error: nice(error.message) } : {};
}

export async function sendRequest(listing: string, message: string, offered?: string): Promise<R> {
  if (!UUID.test(listing)) return { error: "Not found." };
  return rpc("create_request", { p_listing: listing, p_message: message, p_offered: offered?.trim() || null }, listing);
}
export async function withdrawRequest(listing: string, request: string): Promise<R> { return rpc("withdraw_request", { p_request: request }, listing); }
export async function rejectRequest(listing: string, request: string): Promise<R> { return rpc("reject_request", { p_request: request }, listing); }
export async function acceptRequest(listing: string, request: string): Promise<R> { return rpc("accept_request", { p_request: request }, listing); }
export async function fallThrough(listing: string): Promise<R> { return rpc("fall_through", { p_listing: listing }, listing); }

/**
 * The owner's honest exit from a loan that was never returned. Records why, privately,
 * and puts the item back on the board. Without this the only way out was to mark the item
 * Returned, which is untrue and erases the failure from the record.
 */
export async function recoverLent(listing: string, reason: string): Promise<R> {
  if (!UUID.test(listing)) return { error: "Not found." };
  const note = reason.trim();
  if (!note) return { error: "Say briefly what happened, so you have a record of it." };
  if (note.length > 1000) return { error: "Keep the note under 1000 characters." };
  return rpc("recover_lent", { p_listing: listing, p_reason: note }, listing);
}

/** The giver's direct status changes the database allows: accepted to given or lent, lent to returned, returned to available. */
export async function markStatus(listing: string, to: "given" | "lent" | "returned" | "available"): Promise<R> {
  if (!UUID.test(listing)) return { error: "Not found." };
  const { error } = await (await supabaseServer()).from("listings").update({ status: to }).eq("id", listing);
  revalidatePath(`/listings/${listing}`);
  return error ? { error: nice(error.message) } : {};
}

export async function reportListing(listing: string, reason: string): Promise<R> {
  if (!UUID.test(listing)) return { error: "Not found." };
  const text = reason.trim();
  if (!text || text.length > 1000) return { error: "Tell us briefly what is wrong (up to 1000 characters)." };
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const { error } = await sb.from("reports").insert({ listing_id: listing, reporter_id: user.id, reason: text });
  if (error) return { error: error.code === "23505" ? "You already reported this listing." : "Could not send the report." };
  const [{ data: l }, { data: me }] = await Promise.all([
    sb.from("listings").select("title").eq("id", listing).single(),
    sb.from("profiles").select("name").eq("id", user.id).single(),
  ]);
  after(() => sendReport({ title: l?.title ?? "(listing)", listingId: listing, reason: text, reporterName: me?.name ?? "", reporterEmail: user.email ?? "" }));
  return {};
}
