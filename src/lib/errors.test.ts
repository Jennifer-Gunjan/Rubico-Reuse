import { describe, expect, it } from "vitest";
import { GENERIC_ERROR, userMessage } from "./errors";

describe("userMessage", () => {
  it("shows a message our own function raised for the person", () => {
    // Every RPC in 0001 raises plainly, which Postgres reports as P0001.
    expect(userMessage({ code: "P0001", message: "You cannot request your own listing" }))
      .toBe("You cannot request your own listing");
  });

  it("hides a check-constraint violation, which names internals", () => {
    expect(userMessage({
      code: "23514",
      message: 'new row for relation "requests" violates check constraint "requests_message_check"',
    })).toBe(GENERIC_ERROR);
  });

  it("hides a unique violation", () => {
    expect(userMessage({ code: "23505", message: 'duplicate key value violates unique constraint "requests_one_active"' }))
      .toBe(GENERIC_ERROR);
  });

  it("hides a permission error rather than confirming what exists", () => {
    expect(userMessage({ code: "42501", message: "permission denied for table profiles" })).toBe(GENERIC_ERROR);
  });

  it("falls back when there is no error object at all", () => {
    expect(userMessage(null)).toBe(GENERIC_ERROR);
    expect(userMessage(undefined)).toBe(GENERIC_ERROR);
  });

  it("falls back when a code arrives with no message", () => {
    expect(userMessage({ code: "P0001" })).toBe(GENERIC_ERROR);
    expect(userMessage({ code: "P0001", message: "   " })).toBe(GENERIC_ERROR);
  });

  it("falls back when a message arrives with no code", () => {
    // A transport failure carries prose but is not something we chose to say.
    expect(userMessage({ message: "fetch failed" })).toBe(GENERIC_ERROR);
  });
});
