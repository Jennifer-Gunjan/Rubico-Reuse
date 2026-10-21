"use client";
import { useState, useTransition } from "react";
import { Ready } from "@/components/Ready";
import { markFulfilled, respondWanted } from "./actions";

export function HaveThis({ id, mine, responded }: { id: string; mine: boolean; responded: boolean }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(responded ? "You responded. The poster has your contact details." : null);
  if (mine) return <button className="btn secondary" disabled={pending} onClick={() => start(() => markFulfilled(id))}>{pending ? "Saving…" : "Mark as fulfilled"}</button>;
  if (responded && !pending && msg) return <p className="muted">{msg}</p>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await respondWanted(id, note); setMsg(r.error ?? "Sent. The poster now has your name, email and Teams handle."); }); }} className="login">
      <Ready>
      <input className="field" placeholder="Optional note (condition, when you can hand it over)" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
      <button className="btn" disabled={pending}>{pending ? "Sending…" : "I have this"}</button>
      </Ready>
      {msg && <p role="status" className="muted">{msg}</p>}
    </form>
  );
}
