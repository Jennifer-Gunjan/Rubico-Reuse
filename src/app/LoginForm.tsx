"use client";

import { useState } from "react";
import { isAllowedEmail } from "@/lib/domain";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const redirectTo = () => `${location.origin}/auth/callback`;
  // Remember where to go after sign-in in a short-lived cookie (a query string on the redirect URL would not match Supabase's allow-list).
  const remember = () => { if (next) document.cookie = `reuse_next=${encodeURIComponent(next)}; path=/; max-age=1800; samesite=lax`; };

  const UNAVAILABLE = "Google sign-in is not available right now. Use the email link instead.";

  /**
   * signInWithOAuth builds the provider URL in the browser and navigates straight to it,
   * so it never reports that a provider is switched off: the person simply lands on a raw
   * JSON error page outside the app, with no way back. Ask Supabase which providers are on
   * before leaving. If the question itself fails, carry on rather than block a working
   * sign-in on a failed probe.
   */
  async function googleIsOn(): Promise<boolean> {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
      if (!res.ok) return true;
      const settings = await res.json();
      return settings?.external?.google !== false;
    } catch {
      return true;
    }
  }

  async function google() {
    setNote(null);
    if (!(await googleIsOn())) return setNote(UNAVAILABLE);
    remember();
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) setNote(UNAVAILABLE);
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!isAllowedEmail(email)) return setNote("Use your @rubicotech.com or @rubicotech.in address.");
    remember();
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo() },
    });
    setNote(error ? "Could not send the link. Try again in a minute." : "Check your inbox for the sign-in link. If it is missing, look in your spam folder.");
  }

  return (
    <div className="login">
      <button className="btn" onClick={google}>Continue with Google</button>
      <form onSubmit={magicLink} className="login">
        <label htmlFor="email" className="muted">Or get a sign-in link by email</label>
        <input id="email" className="field" type="email" autoComplete="email" required
               placeholder="you@rubicotech.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn secondary" type="submit">Email me a link</button>
      </form>
      {note && <p role="status" className="muted">{note}</p>}
    </div>
  );
}
