import { createServerClient } from "@supabase/ssr";
import type { BrowserContext } from "@playwright/test";

/**
 * Sign in with a password and copy the session cookies exactly as the app's own Supabase
 * helper would write them.
 *
 * Password sign-in is enabled on the project for these tests alone - the product offers only
 * Google and an emailed link. Turning it off breaks this file and tests/live/api.test.ts, and
 * with them the e2e-journey and live-api CI jobs. README section 13 explains the trade.
 */
export async function signIn(context: BrowserContext, baseURL: string, email: string, password: string) {
  const jar = new Map<string, string>();
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach((c) => jar.set(c.name, c.value)) },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`E2E sign-in failed for ${email}: ${error.message}`);
  await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: baseURL })));
  // Make sure the profile is complete so posting and requesting are allowed.
  // teams_handle is the sign-in address: since 0015 the product requires an address, not a handle.
  await sb.from("profiles").update({ name: email.split("@")[0], location: "Dehradun", teams_handle: email }).eq("id", data.user.id);
  return data.user.email!;
}
