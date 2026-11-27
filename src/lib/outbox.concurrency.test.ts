import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * flushOutbox runs after every server action and from the daily cron, so several
 * sweeps can overlap. These tests drive two overlapping sweeps over one pending
 * row and pin down that a notification is emailed exactly once.
 */

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Row = {
  id: string; type: string; message: string; payload: Record<string, string> | null;
  email_attempts: number; email_status: string; profiles: { email: string };
};

const store: { rows: Row[] } = { rows: [] };
const sent: string[] = [];

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: async (m: { to: string }) => { await tick(5); sent.push(m.to); return {}; },
    }),
  },
}));

/** A small stand-in for the PostgREST client: filters actually narrow the rows. */
vi.mock("./supabase/admin", () => ({
  supabaseAdmin: () => ({
    from(table: string) {
      const read = {
        select: () => read,
        eq: () => read,
        lt: () => read,
        order: () => read,
        limit: async () => {
          await tick(5); // a real round trip, so two sweeps interleave
          return table === "notifications"
            ? { data: store.rows.filter((r) => r.email_status === "pending" && r.email_attempts < 3).map((r) => ({ ...r })) }
            : { data: [] };
        },
        single: async () => ({ data: null }),
        update(patch: Partial<Row>) {
          const where: Record<string, unknown> = {};
          let done = false;
          const apply = async () => {
            if (done) return { data: [], error: null };
            done = true;
            await tick(1);
            const hit = store.rows.filter((r) =>
              Object.entries(where).every(([c, v]) => (r as unknown as Record<string, unknown>)[c] === v));
            hit.forEach((r) => Object.assign(r, patch));
            return { data: hit.map((r) => ({ id: r.id })), error: null };
          };
          const write = {
            eq(col: string, val: unknown) { where[col] = val; return write; },
            select: () => apply(),
            then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => apply().then(ok, bad),
          };
          return write;
        },
      };
      return read;
    },
  }),
}));

const pendingRow = (): Row => ({
  id: "n1", type: "new_request", message: 'New request for "Desk"',
  payload: { listing_id: "l1" }, email_attempts: 0, email_status: "pending",
  profiles: { email: "seeker@rubicotech.in" },
});

describe("flushOutbox under overlapping sweeps", () => {
  beforeEach(() => {
    process.env.SMTP_USER = "u";
    process.env.SMTP_PASS = "p";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    sent.length = 0;
    store.rows = [pendingRow()];
  });

  it("emails a notification exactly once when two sweeps overlap", async () => {
    const { flushOutbox } = await import("./outbox");
    await Promise.all([flushOutbox(), flushOutbox()]);
    expect(sent).toEqual(["seeker@rubicotech.in"]);
  });

  it("counts the send once, so the sweep does not double-report", async () => {
    const { flushOutbox } = await import("./outbox");
    const [a, b] = await Promise.all([flushOutbox(), flushOutbox()]);
    expect(a.sent + b.sent).toBe(1);
  });

  it("marks the row sent with exactly one attempt recorded", async () => {
    const { flushOutbox } = await import("./outbox");
    await Promise.all([flushOutbox(), flushOutbox()]);
    expect(store.rows[0].email_status).toBe("sent");
    expect(store.rows[0].email_attempts).toBe(1);
  });

  it("still sends a lone pending row on a single sweep", async () => {
    const { flushOutbox } = await import("./outbox");
    const out = await flushOutbox();
    expect(sent).toEqual(["seeker@rubicotech.in"]);
    expect(out).toEqual({ sent: 1, failed: 0 });
    expect(store.rows[0].email_status).toBe("sent");
  });

  it("gives up after MAX_ATTEMPTS and never sends a row already at the cap", async () => {
    store.rows = [{ ...pendingRow(), email_attempts: 3 }];
    const { flushOutbox } = await import("./outbox");
    await flushOutbox();
    expect(sent).toEqual([]);
    expect(store.rows[0].email_status).toBe("pending");
  });
});
