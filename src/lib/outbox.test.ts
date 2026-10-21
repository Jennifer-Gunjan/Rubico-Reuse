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
  it("never includes contact details", () => {
    expect(emailFor({ type: "request_accepted", message: "Accepted", payload: {} }, "https://x.test").text).not.toMatch(/@|Teams/);
  });
});
