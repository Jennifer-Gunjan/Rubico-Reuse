import { describe, expect, it } from "vitest";
import { emailFor } from "./outbox";

describe("emailFor", () => {
  it("links to the listing when the payload has one", () => {
    const m = emailFor({ type: "new_request", message: 'New request for "Desk"', payload: { listing_id: "abc" } }, "https://x.test");
    expect(m.subject).toBe('Rubico ReUse: New request for "Desk"');
    expect(m.text).toContain("https://x.test/listings/abc");
  });
  it("falls back to the notifications page", () => {
    expect(emailFor({ type: "x", message: "m", payload: null }, "https://x.test").text).toContain("https://x.test/notifications");
  });
  const c = { name: "Asha", email: "asha@rubicotech.in", teams_handle: "asha.t" };
  it("includes contact details only for accepted requests and wanted responses", () => {
    expect(emailFor({ type: "request_accepted", message: "m", payload: {} }, "https://x.test", c).text).toContain("asha@rubicotech.in");
    expect(emailFor({ type: "wanted_response", message: "m", payload: {} }, "https://x.test", c).text).toContain("Teams: asha.t");
    expect(emailFor({ type: "new_request", message: "m", payload: {} }, "https://x.test", c).text).not.toMatch(/asha/);
  });
  it("sends no contact block when none is available", () => {
    expect(emailFor({ type: "request_accepted", message: "m", payload: {} }, "https://x.test").text).not.toMatch(/Contact:/);
  });
});

import { reportEmail } from "./outbox";
describe("reportEmail", () => {
  it("names the listing, link, reason and reporter", () => {
    const m = reportEmail({ title: "Desk", listingId: "abc", reason: "Not allowed", reporterName: "Asha", reporterEmail: "a@rubicotech.in" }, "https://x.test");
    expect(m.subject).toContain("Desk");
    expect(m.text).toContain("https://x.test/listings/abc");
    expect(m.text).toContain("Not allowed");
    expect(m.text).toContain("a@rubicotech.in");
  });
});

describe("sendMail", () => {
  it("returns false without SMTP settings, so rows stay pending", async () => {
    delete process.env.SMTP_USER; delete process.env.SMTP_PASS;
    const { sendMail } = await import("./outbox");
    expect(await sendMail({ to: "a@rubicotech.in", subject: "s", text: "t" })).toBe(false);
  });
  it("returns false (never throws) when the SMTP server is unreachable", async () => {
    process.env.SMTP_USER = "u"; process.env.SMTP_PASS = "p"; process.env.SMTP_HOST = "127.0.0.1"; process.env.SMTP_PORT = "1";
    const { sendMail } = await import("./outbox");
    expect(await sendMail({ to: "a@rubicotech.in", subject: "s", text: "t" })).toBe(false);
  });
});
