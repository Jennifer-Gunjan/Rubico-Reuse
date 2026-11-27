import { NextResponse } from "next/server";
import { outboxCounts, outboxAlert } from "@/lib/health";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Liveness for an external uptime check. Returns 200 when healthy and 503 when not, so any
 * free checker can alert without needing an API key or understanding the body.
 *
 * It reports the notification queue on purpose: the nightly job cannot report that it has
 * stopped running, because the report lives inside it. Polling this from outside is what
 * closes that gap. The body carries status words only, never counts or colleague data, so
 * it is safe to leave open.
 */
export async function GET() {
  const checks: Record<string, string> = {};

  try {
    const sb = await supabaseServer();
    const { error } = await sb.from("public_listings").select("id", { count: "exact", head: true });
    checks.database = error ? "down" : "ok";
  } catch {
    checks.database = "down";
  }

  checks.email = process.env.SMTP_USER && process.env.SMTP_PASS ? "configured" : "not_configured";

  const counts = await outboxCounts();
  checks.notifications = counts === null ? "unknown" : outboxAlert(counts) ? "stuck" : "ok";

  const healthy = checks.database === "ok" && checks.notifications !== "stuck";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, time: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
}
