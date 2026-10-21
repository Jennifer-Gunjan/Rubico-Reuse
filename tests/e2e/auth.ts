import { createServerClient } from "@supabase/ssr";
import type { BrowserContext } from "@playwright/test";

/** Sign in with a password and copy the session cookies exactly as the app's own Supabase helper would write them. */
export async function signIn(context: BrowserContext, baseURL: string, email: string, password: string) {
  const jar = new Map<string, string>();
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach((c) => jar.set(c.name, c.value)) },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`E2E sign-in failed for ${email}: ${error.message}`);
  await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: baseURL })));
  // Make sure the profile is complete so posting and requesting are allowed.
  await sb.from("profiles").update({ name: email.split("@")[0], location: "Dehradun", teams_handle: `e2e-${email.split("@")[0]}` }).eq("id", data.user.id);
  return data.user.email!;
}
