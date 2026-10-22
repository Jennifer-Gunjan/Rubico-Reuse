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
