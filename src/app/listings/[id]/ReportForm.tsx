"use client";
import { useState, useTransition } from "react";
import { Ready } from "@/components/Ready";
import { reportListing } from "./actions";

export function ReportForm({ listingId }: { listingId: string }) {
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <details style={{ marginTop: 24 }}>
      <summary className="muted" style={{ cursor: "pointer" }}>Report this listing</summary>
      <form className="login" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await reportListing(listingId, reason); setMsg(r.error ?? "Thanks. The product owner has been told."); }); }}>
        <Ready>
        <textarea className="field" style={{ minHeight: 80, padding: 12 }} required maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What is wrong with this listing?" aria-label="Reason" />
        <button className="btn secondary" disabled={pending}>{pending ? "Sending…" : "Send report"}</button>
        </Ready>
        {msg && <p role="status" className="muted">{msg}</p>}
      </form>
    </details>
  );
}
