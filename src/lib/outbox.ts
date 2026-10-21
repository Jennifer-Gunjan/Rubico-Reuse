import { supabaseAdmin } from "./supabase/admin";

export const MAX_ATTEMPTS = 3;

type N = { type: string; message: string; payload: { listing_id?: string } | null };

/** Plain-text email for a notification. Pure, so it is unit tested. */
export function emailFor(n: N, appUrl: string) {
  const link = n.payload?.listing_id ? `${appUrl}/listings/${n.payload.listing_id}` : `${appUrl}/notifications`;
  return { subject: `Rubico ReUse: ${n.message}`, text: `${n.message}\n\nOpen it here: ${link}\n\nYou get this email because you use Rubico ReUse.` };
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
        const mail = emailFor(n, appUrl);
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
      ok ? out.sent++ : out.failed++;
    }
  } catch {
    // email is best effort: the in-app notification already exists
  }
  return out;
}
