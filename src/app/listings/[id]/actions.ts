"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

type R = { error?: string };
const UUID = /^[0-9a-f-]{36}$/i;
const nice = (m?: string) => m || "Something went wrong. Please try again.";

async function rpc(fn: string, args: Record<string, unknown>, listing: string): Promise<R> {
  if (Object.values(args).some((v) => typeof v === "string" && fn !== "create_request" && !UUID.test(v))) return { error: "Not found." };
  const { error } = await (await supabaseServer()).rpc(fn, args);
  revalidatePath(`/listings/${listing}`);
  return error ? { error: nice(error.message) } : {};
}

export const sendRequest = (listing: string, message: string, offered?: string) =>
  UUID.test(listing) ? rpc("create_request", { p_listing: listing, p_message: message, p_offered: offered?.trim() || null }, listing) : Promise.resolve({ error: "Not found." });
export const withdrawRequest = (listing: string, request: string) => rpc("withdraw_request", { p_request: request }, listing);
export const rejectRequest = (listing: string, request: string) => rpc("reject_request", { p_request: request }, listing);
export const acceptRequest = (listing: string, request: string) => rpc("accept_request", { p_request: request }, listing);
export const fallThrough = (listing: string) => rpc("fall_through", { p_listing: listing }, listing);

/** The giver's direct status changes the database allows: accepted to given or lent, lent to returned, returned to available. */
export async function markStatus(listing: string, to: "given" | "lent" | "returned" | "available"): Promise<R> {
  if (!UUID.test(listing)) return { error: "Not found." };
  const { error } = await (await supabaseServer()).from("listings").update({ status: to }).eq("id", listing);
  revalidatePath(`/listings/${listing}`);
  return error ? { error: nice(error.message) } : {};
}
