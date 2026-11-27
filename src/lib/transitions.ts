export const LISTING_STATUSES = [
  "available",
  "requested",
  "accepted",
  "given",
  "lent",
  "returned",
  "closed",
] as const;
export const LISTING_TYPES = ["donate", "exchange", "sell", "lend"] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];
export type ListingType = (typeof LISTING_TYPES)[number];

// Mirrors the database trigger in supabase/migrations. Keep the two in step.
const MOVES: Record<ListingStatus, ListingStatus[]> = {
  available: ["requested", "closed"],
  requested: ["requested", "available", "accepted", "closed"],
  accepted: ["given", "lent", "available"],
  lent: ["returned", "available"],   // available = recorded as not returned
  returned: ["available"],
  closed: ["available"],
  given: ["accepted"],   // only within the correction window (0014)
};

export function canTransition(from: ListingStatus, to: ListingStatus, type: ListingType): boolean {
  if (!MOVES[from].includes(to)) return false;
  if (to === "given" || (from === "given" && to === "accepted")) return type !== "lend";
  if (to === "lent" || from === "lent" || from === "returned") return type === "lend";
  return true;
}
