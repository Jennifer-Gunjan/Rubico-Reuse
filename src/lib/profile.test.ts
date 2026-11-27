import { describe, expect, it } from "vitest";
import { isPublicPath, profileComplete, safeNext } from "./profile";

describe("profileComplete", () => {
  it("needs name, city and Slack email", () => {
    expect(profileComplete({ name: "Asha", location: "Dehradun", teams_handle: "asha" })).toBe(true);
    expect(profileComplete({ name: "Asha", location: null, teams_handle: "asha" })).toBe(false);
    expect(profileComplete({ name: "Asha", location: "Dehradun", teams_handle: "  " })).toBe(false);
    expect(profileComplete({ name: "", location: "Dehradun", teams_handle: "a" })).toBe(false);
    expect(profileComplete(null)).toBe(false);
  });
});

describe("safeNext", () => {
  it("keeps paths inside the site", () => {
    expect(safeNext("/listings/abc")).toBe("/listings/abc");
    expect(safeNext("/browse?q=desk")).toBe("/browse?q=desk");
  });
  it("rejects anything that could leave the site", () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "evil", "", null, undefined, "/a\r\nSet-Cookie: x=1"])
      expect(safeNext(bad as string | null | undefined)).toBe("/browse");
  });
});

describe("isPublicPath", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  it("allows landing, browse and one listing", () => {
    for (const p of ["/", "/browse", `/listings/${id}`]) expect(isPublicPath(p), p).toBe(true);
  });
  it("keeps every action page private", () => {
    for (const p of ["/my", "/wanted", "/wanted/new", "/profile", "/notifications", "/listings/new", `/listings/${id}/edit`, "/listings/x"])
      expect(isPublicPath(p), p).toBe(false);
  });
});

import { PROFILE_ERRORS, validateProfile } from "./profile";
const LOC = ["Haridwar", "Dehradun"] as const;
const good = { name: "Asha", location: "Dehradun", teams_handle: "asha@rubicotech.com" };

describe("validateProfile", () => {
  it("accepts a complete profile", () => expect(validateProfile(good, LOC)).toBeNull());
  it("needs a name", () => expect(validateProfile({ ...good, name: "  " }, LOC)).toBe("name"));
  it("needs a city the dropdown offers", () => {
    expect(validateProfile({ ...good, location: "" }, LOC)).toBe("city");
    expect(validateProfile({ ...good, location: "Delhi" }, LOC)).toBe("city");
  });
  it("needs a Slack email", () => expect(validateProfile({ ...good, teams_handle: " " }, LOC)).toBe("handle"));
  it("accepts either an address or a Slack handle", () => {
    // The product disagrees with itself: the column is teams_handle and fixtures store
    // "@alice", but the form says "Slack email". Both reach a person, so both are allowed.
    for (const ok of ["asha@rubicotech.com", "@asha", "asha", "asha.t", "e2e-winston"])
      expect(validateProfile({ ...good, teams_handle: ok }, LOC), ok).toBeNull();
  });
  it("rejects text that cannot reach anyone", () => {
    // This value is emailed to a matched colleague, so unreachable text breaks the hand-over.
    for (const bad of ["not-an-email-at-all-!!!", "a b", "@", "!!!", "a", "asha@rubico tech.com"])
      expect(validateProfile({ ...good, teams_handle: bad }, LOC), bad).toBe("handle_format");
  });
  it("returns codes, never sentences, so the page never renders text from the URL", () => {
    const code = validateProfile({ ...good, name: "" }, LOC)!;
    expect(Object.keys(PROFILE_ERRORS)).toContain(code);
  });
});
