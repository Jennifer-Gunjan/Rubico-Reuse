/** Same rule as the database's profile_complete(): a name, a city and a Slack email. */
export const profileComplete = (p: { name?: string | null; location?: string | null; teams_handle?: string | null } | null | undefined) =>
  !!p && !!p.name?.trim() && !!p.location && !!p.teams_handle?.trim();

/** Only ever redirect to a path inside this site (blocks //evil.com, https://evil.com and backslash tricks). */
export function safeNext(next: string | null | undefined, fallback = "/browse"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\r\n]/.test(next)) return fallback;
  return next;
}

/** Pages a visitor may read without signing in: the landing page, Browse and a single listing. */
export const isPublicPath = (p: string) =>
  ["/", "/browse", "/auth/callback", "/api/cron/emails", "/api/health", "/robots.txt", "/icon.svg"].includes(p) || /^\/listings\/[0-9a-f-]{36}$/i.test(p);

/**
 * The Slack contact is an email address. Settled with the product owner: the column is named
 * teams_handle and early fixtures stored handles, but the form has always asked for an
 * address and that is what the product means. Mirrors the DB check in 0015.
 *
 * Shape only - a name, an @ and a dotted host. The domain is deliberately not restricted to
 * Rubico, because a colleague's Slack address need not match their sign-in domain.
 */
export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type ProfileInput = { name: string; location: string; teams_handle: string };

/**
 * Codes rather than sentences, so the page never renders text taken from the URL. A crafted
 * ?error= could otherwise put any words in the error box, which is a social-engineering
 * vector even though React escapes it.
 */
export const PROFILE_ERRORS = {
  name: "Add your name.",
  city: "Choose your city.",
  handle: "Add your Slack email.",
  handle_format: "Enter your Slack email as an address, for example name@rubicotech.com.",
  missing: "Your profile record was not found. Sign out, sign in again, and tell the product owner if this repeats.",
  save: "Could not save your profile. Please try again.",
} as const;
export type ProfileError = keyof typeof PROFILE_ERRORS;

/**
 * Returns an error message, or null when the input is acceptable.
 *
 * The Slack email matters more than it looks: after a giver accepts, this is the address
 * emailed to the matched colleague as the way to reach them. Nothing downstream can tell
 * that "asdf" is not reachable, so the hand-over simply fails in silence.
 */
export function validateProfile(i: ProfileInput, locations: readonly string[]): ProfileError | null {
  if (!i.name.trim()) return "name";
  if (!locations.includes(i.location)) return "city";
  const handle = i.teams_handle.trim();
  if (!handle) return "handle";
  if (!EMAIL.test(handle)) return "handle_format";
  return null;
}
