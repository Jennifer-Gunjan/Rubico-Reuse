import { describe, expect, it } from "vitest";
import { isAllowedEmail } from "./domain";

describe("isAllowedEmail", () => {
  it.each(["a@rubicotech.com", "a@rubicotech.in", "A.B@RubicoTech.COM", " a@rubicotech.in "])(
    "accepts %s",
    (e) => expect(isAllowedEmail(e)).toBe(true),
  );

  it.each([
    "a@gmail.com",
    "a@rubicotech.org",
    "a@rubicotech.com.evil.com",
    "a@evilrubicotech.com",
    "a@mail.rubicotech.com",
    "a@b@rubicotech.com",
    "rubicotech.com",
    "@rubicotech.com",
    "",
  ])("rejects %s", (e) => expect(isAllowedEmail(e)).toBe(false));

  it("takes the allowed list from one config argument", () => {
    expect(isAllowedEmail("a@other.org", ["other.org"])).toBe(true);
  });
});
