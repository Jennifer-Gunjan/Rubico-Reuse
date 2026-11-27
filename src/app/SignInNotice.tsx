"use client";

import { useEffect, useState } from "react";

const ERRORS: Record<string, string> = {
  domain: "Only @rubicotech.com and @rubicotech.in accounts can sign in.",
  signin: "Sign-in did not complete. Please try again.",
  config: "The app is not configured yet.",
};

/**
 * Supabase reports why a link failed in the URL fragment, which browsers never send to a
 * server. The callback therefore sees no code and falls back to "please try again" - advice
 * that cannot work, because the same dead link fails the same way every time. Reading the
 * fragment here is the only way to say what actually happened.
 */
const LINK_ERRORS: Record<string, string> = {
  otp_expired: "That sign-in link has expired or was already used. Links work once, so request a new one below.",
  access_denied: "That sign-in link is no longer valid. Request a new one below.",
};

export function SignInNotice({ code }: { code?: string }) {
  const [message, setMessage] = useState(code ? ERRORS[code] ?? ERRORS.signin : null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const specific = LINK_ERRORS[hash.get("error_code") ?? ""] ?? LINK_ERRORS[hash.get("error") ?? ""];
    if (!specific) return;
    setMessage(specific);
    // Drop the fragment so a reload does not repeat a message about a link that is now gone.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  if (!message) return null;
  return <p className="error" role="alert">{message}</p>;
}
