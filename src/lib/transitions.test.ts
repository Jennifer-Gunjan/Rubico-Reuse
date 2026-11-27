import { describe, expect, it } from "vitest";
import { canTransition, LISTING_STATUSES, LISTING_TYPES } from "./transitions";

// The spec: every allowed move, as "from>to:types". Anything not listed must be rejected.
const ALL = "donate,exchange,sell,lend";
const NON_LEND = "donate,exchange,sell";
const SPEC = [
  `available>requested:${ALL}`,
  `requested>requested:${ALL}`,
  `requested>available:${ALL}`,
  `requested>accepted:${ALL}`,
  `accepted>given:${NON_LEND}`,
  `accepted>lent:lend`,
  `lent>returned:lend`,
  `lent>available:lend`,        // the owner recorded it as not returned (0010)
  `returned>available:lend`,
  `accepted>available:${ALL}`,
  `available>closed:${ALL}`,
  `requested>closed:${ALL}`,
  `closed>available:${ALL}`,
];

const allowed = new Set(
  SPEC.flatMap((line) => {
    const [pair, types] = line.split(":");
    return types.split(",").map((t) => `${pair}:${t}`);
  }),
);

describe("listing transition matrix", () => {
  for (const type of LISTING_TYPES) {
    for (const from of LISTING_STATUSES) {
      for (const to of LISTING_STATUSES) {
        const ok = allowed.has(`${from}>${to}:${type}`);
        it(`${type}: ${from} -> ${to} is ${ok ? "allowed" : "rejected"}`, () => {
          expect(canTransition(from, to, type)).toBe(ok);
        });
      }
    }
  }

  it("Given is final", () => {
    for (const type of LISTING_TYPES)
      for (const to of LISTING_STATUSES) expect(canTransition("given", to, type)).toBe(false);
  });
});
