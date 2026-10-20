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
export const cleanSearch = (q: string) => q.replace(/[,()%_\\*]/g, " ").trim().slice(0, 60);
