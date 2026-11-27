import { MAX_ATTEMPTS, sendMail } from "./outbox";
import { supabaseAdmin } from "./supabase/admin";

/**
 * The outbox is written never to throw, so a broken SMTP account or a cron that stopped
 * running leaves no error anywhere: pages load, tests pass, and notifications silently
 * stop reaching people. These checks watch the notifications table itself, which is the
 * only place that failure is visible.
 */

/** A pending row older than this has outlived several sweeps, so the queue is not draining. */
export const STALE_HOURS = 24;

export type OutboxCounts = { failed: number; stale: number };
export type Thresholds = { failed: number; stale: number };

/** One permanently failed email already means nobody was told their request was accepted. */
export const DEFAULT_THRESHOLDS: Thresholds = { failed: 1, stale: 5 };

/** Returns the alert text, or null when the queue is healthy. Pure, so it is unit tested. */
export function outboxAlert(c: OutboxCounts, t: Thresholds = DEFAULT_THRESHOLDS): string | null {
  const problems: string[] = [];
  if (c.failed >= t.failed) {
    problems.push(
      `${c.failed} notification${c.failed === 1 ? "" : "s"} gave up after ${MAX_ATTEMPTS} attempts. ` +
      `Those colleagues were never told. The usual cause is an expired or revoked SMTP password.`);
  }
  if (c.stale >= t.stale) {
    problems.push(
      `${c.stale} notification${c.stale === 1 ? "" : "s"} have been waiting over ${STALE_HOURS} hours. ` +
      `The queue is not draining, so check that the daily retry job is still running.`);
  }
  if (!problems.length) return null;
  return `Rubico ReUse: notifications are not reaching people.\n\n${problems.join("\n\n")}\n\n` +
    `Check the notifications table: select email_status, count(*) from notifications group by 1;`;
}

/** Counts the two states that mean notifications are not getting through. Never throws. */
export async function outboxCounts(): Promise<OutboxCounts | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const db = supabaseAdmin();
    const since = new Date(Date.now() - STALE_HOURS * 3_600_000).toISOString();
    const [failed, stale] = await Promise.all([
      db.from("notifications").select("id", { count: "exact", head: true }).eq("email_status", "failed"),
      db.from("notifications").select("id", { count: "exact", head: true })
        .eq("email_status", "pending").lt("created_at", since),
    ]);
    return { failed: failed.count ?? 0, stale: stale.count ?? 0 };
  } catch {
    return null;
  }
}

/**
 * Runs after the nightly sweep and emails the product owner when notifications are stuck.
 * Uses the SMTP and owner address already configured, so no third-party service is involved
 * and no colleague data leaves this infrastructure. Never throws.
 */
export async function checkOutbox(): Promise<{ checked: boolean; alerted: boolean; counts?: OutboxCounts }> {
  const counts = await outboxCounts();
  if (!counts) return { checked: false, alerted: false };
  const text = outboxAlert(counts);
  if (!text) return { checked: true, alerted: false, counts };
  const to = process.env.PRODUCT_OWNER_EMAIL;
  const alerted = to ? await sendMail({ to, subject: "Rubico ReUse: notifications are stuck", text }) : false;
  return { checked: true, alerted, counts };
}
