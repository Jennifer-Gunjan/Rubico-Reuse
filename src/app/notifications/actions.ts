"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export async function markAllRead() {
  await (await supabaseServer()).from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/notifications");
}
