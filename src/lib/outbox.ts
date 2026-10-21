import { supabaseAdmin } from "./supabase/admin";

export const MAX_ATTEMPTS = 3;

type N = { type: string; message: string; payload: { listing_id?: string; responder_id?: string } | null };
export type Contact = { name: string; email: string; teams_handle: string | null };

/** Per the notification table: only "request accepted" and "I have this" emails carry the other person's contact details. */
export const CONTACT_TYPES = ["request_accepted", "wanted_response"];

/** Plain-text email for a notification. Pure, so it is unit tested. */
export function emailFor(n: N, appUrl: string, contact?: Contact | null) {
  const link = n.payload?.listing_id ? `${appUrl}/listings/${n.payload.listing_id}` : `${appUrl}/notifications`;
  const who = contact && CONTACT_TYPES.includes(n.type) ? `\n\nContact: ${contact.name}\nEmail: ${contact.email}\nTeams: ${contact.teams_handle ?? "not set"}` : "";
  return { subject: `Rubico ReUse: ${n.message}`, text: `${n.message}${who}\n\nOpen it here: ${link}\n\nYou get this email because you use Rubico ReUse.` };
}

/** The other party's details for the two email types that carry them. Service-role lookup; never throws. */
async function contactFor(db: ReturnType<typeof supabaseAdmin>, n: N): Promise<Contact | null> {
  try {
    let id: string | null | undefined;
    if (n.type === "wanted_response") id = n.payload?.responder_id;
    else if (n.type === "request_accepted" && n.payload?.listing_id)
      id = (await db.from("listings").select("owner_id").eq("id", n.payload.listing_id).single()).data?.owner_id;
    if (!id) return null;
    return (await db.from("profiles").select("name,email,teams_handle").eq("id", id).single()).data;
  } catch {
    return null;
  }
}

/** Sends pending notification emails. Safe to call often; each row is tried at most MAX_ATTEMPTS times. Never throws. */
export async function flushOutbox(): Promise<{ sent: number; failed: number }> {
  const out = { sent: 0, failed: 0 };
  const key = process.env.RESEND_API_KEY;
  if (!key || !process.env.SUPABASE_SERVICE_ROLE_KEY) return out; // not configured: leave rows pending
  try {
    const db = supabaseAdmin();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rubico-reuse.vercel.app";
    const from = process.env.RESEND_FROM ?? "Rubico ReUse <onboarding@resend.dev>";
    const { data } = await db.from("notifications")
      .select("id,type,message,payload,email_attempts,profiles(email)")
      .eq("email_status", "pending").lt("email_attempts", MAX_ATTEMPTS).order("created_at").limit(25);
    for (const n of data ?? []) {
      const to = (n.profiles as unknown as { email: string } | null)?.email;
      let ok = false;
      if (to) {
        const mail = emailFor(n, appUrl, await contactFor(db, n));
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to, ...mail }),
        }).catch(() => null);
        ok = !!res?.ok;
      }
      const attempts = n.email_attempts + 1;
      await db.from("notifications").update({
        email_status: ok ? "sent" : attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        email_attempts: attempts,
      }).eq("id", n.id);
      if (ok) out.sent++; else out.failed++;
    }
  } catch {
    // email is best effort: the in-app notification already exists
  }
  return out;
}
