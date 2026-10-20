import { describe, expect, it } from "vitest";
import { findBannedKeyword } from "./banned";

describe("findBannedKeyword", () => {
  it.each([
    "Old medicine for sale",
    "Pistol, barely used",
    "FIREARM cleaning kit",
    "box of ammunition",
    "Antibiotics leftover",
  ])("blocks %s", (t) => expect(findBannedKeyword(t)).not.toBeNull());

  it.each(["Glue gun and sticks", "Samsung tablet 10 inch", "Steel kitchen knife set", "Study table"])(
    "allows %s",
    (t) => expect(findBannedKeyword(t)).toBeNull(),
  );

  it("matches whole words only", () => {
    expect(findBannedKeyword("Medicinella plant")).toBeNull();
  });
});
