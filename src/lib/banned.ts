// Starter list, light protection only. Final list to be confirmed by the product owner.
// Bare "gun", "tablet" and "knife" are left out on purpose: glue guns, tablets and kitchen knives are fine.
const BANNED = [
  "medicine",
  "medicines",
  "medication",
  "medications",
  "antibiotic",
  "antibiotics",
  "painkiller",
  "painkillers",
  "prescription",
  "weapon",
  "weapons",
  "firearm",
  "firearms",
  "pistol",
  "pistols",
  "revolver",
  "rifle",
  "rifles",
  "shotgun",
  "ammunition",
  "explosive",
  "explosives",
];

const PATTERN = new RegExp(`\\b(${BANNED.join("|")})\\b`, "i");

export function findBannedKeyword(text: string): string | null {
  return PATTERN.exec(text)?.[1].toLowerCase() ?? null;
}
