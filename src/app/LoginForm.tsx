"use client";

import { useState } from "react";
import { isAllowedEmail } from "@/lib/domain";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const redirectTo = () => `${location.origin}/auth/callback`;

  async function google() {
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) setNote("Google sign-in is not available right now. Use the email link instead.");
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!isAllowedEmail(email)) return setNote("Use your @rubicotech.com or @rubicotech.in address.");
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
