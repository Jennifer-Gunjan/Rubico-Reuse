"use client";
import { useState, useTransition } from "react";

/** A one-click action button that shows progress and any error the action returns. */
export function ActionButton({ label, busyLabel, run }: { label: string; busyLabel: string; run: () => Promise<{ error?: string }> }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button type="button" className="btn secondary" disabled={pending} onClick={() => start(async () => setErr((await run()).error ?? null))}>{pending ? busyLabel : label}</button>
      {err && <p className="error" role="alert">{err}</p>}
    </>
  );
}
