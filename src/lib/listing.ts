import { findBannedKeyword } from "./banned";

export const CATEGORIES = ["Furniture","Electronics","Books","Clothing","Kitchen","Kids and baby","Sports","Home and garden","Other"] as const;
export const CONDITIONS = { new: "New", like_new: "Like new", good: "Good", fair: "Fair" } as const;
export const TYPES = { donate: "Free", exchange: "Exchange", sell: "Sell", lend: "Lend" } as const;
export const LOCATIONS = ["Haridwar", "Dehradun"] as const;

export type ListingInput = {
  title: string; description: string; category: string; condition: string; type: string; location: string;
  asking_price?: string; negotiable?: boolean; wanted_in_return?: string; lend_duration_text?: string;
};

/** Returns an error message, or null when the input is acceptable. Mirrors the DB checks, plus the banned-item list. */
export function validateListing(i: ListingInput): string | null {
  const title = i.title.trim(), desc = i.description.trim();
  if (title.length < 3 || title.length > 100) return "Title must be 3 to 100 characters.";
  if (!desc || desc.length > 2000) return "Add a description (up to 2000 characters).";
  if (!(CATEGORIES as readonly string[]).includes(i.category)) return "Choose a category.";
  if (!(i.condition in CONDITIONS)) return "Choose a condition.";
  if (!(i.type in TYPES)) return "Choose a type.";
  if (!(LOCATIONS as readonly string[]).includes(i.location)) return "Choose Haridwar or Dehradun.";
  if (i.type === "sell") {
    const p = Number(i.asking_price);
    if (!i.asking_price?.trim() || !Number.isFinite(p) || p < 0) return "Enter a valid asking price.";
  }
  const hit = findBannedKeyword(`${title} ${desc} ${i.wanted_in_return ?? ""}`);
  if (hit) return `"${hit}" items cannot be listed on Rubico ReUse.`;
  return null;
}

/** Strip characters that would break a PostgREST or() filter or act as LIKE wildcards. */
/** Keep only filter values the controls offer, so a bad URL shows everything instead of an empty list. */
export function cleanFilters(sp: { q?: string; category?: string; location?: string; type?: string }) {
  const pick = (v: string | undefined, ok: readonly string[]) => (v && ok.includes(v) ? v : undefined);
  return { q: sp.q?.trim() || undefined, category: pick(sp.category, CATEGORIES), location: pick(sp.location, LOCATIONS), type: pick(sp.type, Object.keys(TYPES)) };
}
export const cleanSearch = (q: string) => q.replace(/[,()%_\\*]/g, " ").trim().slice(0, 60);

/** Photo slots (0..3) not used by kept photos, lowest first; at most `count` returned. */
export const freePositions = (kept: number[], count: number) =>
  [0, 1, 2, 3].filter((p) => !kept.includes(p)).slice(0, count);

export type WantedInput = { title: string; description: string; category: string; location: string };

export function validateWanted(i: WantedInput): string | null {
  const title = i.title.trim(), desc = i.description.trim();
  if (title.length < 3 || title.length > 100) return "Title must be 3 to 100 characters.";
  if (!desc || desc.length > 2000) return "Add a description (up to 2000 characters).";
  if (!(CATEGORIES as readonly string[]).includes(i.category)) return "Choose a category.";
  if (!(LOCATIONS as readonly string[]).includes(i.location)) return "Choose Haridwar or Dehradun.";
  const hit = findBannedKeyword(`${title} ${desc}`);
  return hit ? `"${hit}" items cannot be requested on Rubico ReUse.` : null;
}

export const CATEGORY_ICON: Record<string, string> = {
  Furniture: "🪑", Electronics: "🔌", Books: "📚", Clothing: "👕", Kitchen: "🍳",
  "Kids and baby": "🧸", Sports: "⚽", "Home and garden": "🪴", Other: "📦",
};

/** "Free", "₹500", "Exchange" or "Lend": what a tile shows first. */
export const priceLabel = (type: string, price: number | null) =>
  type === "sell" ? `₹${price ?? 0}` : type === "donate" ? "Free" : type === "exchange" ? "Exchange" : "Lend";

/** "today", "yesterday", "5 days ago", "3 months ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  const days = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}
