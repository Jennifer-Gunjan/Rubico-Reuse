// The one list of communities allowed to sign in. Add a domain here to extend.
export const ALLOWED_DOMAINS = ["rubicotech.com", "rubicotech.in"];

export function isAllowedEmail(email: string, allowed: string[] = ALLOWED_DOMAINS): boolean {
  const parts = email.trim().toLowerCase().split("@");
  return parts.length === 2 && parts[0] !== "" && allowed.includes(parts[1]);
}
