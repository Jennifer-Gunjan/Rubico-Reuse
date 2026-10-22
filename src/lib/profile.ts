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
  ["/", "/browse", "/auth/callback", "/api/cron/emails"].includes(p) || /^\/listings\/[0-9a-f-]{36}$/i.test(p);
