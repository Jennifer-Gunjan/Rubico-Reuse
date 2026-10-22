"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Ready } from "@/components/Ready";
import { CATEGORIES, LOCATIONS, type WantedInput } from "@/lib/listing";
import { createWanted } from "./actions";

export function WantedForm({ defaultLocation }: { defaultLocation: string }) {
  const router = useRouter();
  const [f, setF] = useState<WantedInput>({ title: "", description: "", category: "", location: defaultLocation });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sent = useRef(false); // a ref blocks a second click that lands before the re-render
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sent.current) return;
    sent.current = true; setBusy(true); setError(null);
    const r = await createWanted(f);
    if (r.error) { sent.current = false; setBusy(false); return setError(r.error); }
    router.push("/wanted"); // stay locked while navigating
  }
  return (
    <form onSubmit={submit} className="card login">
      {error && <p className="error" role="alert">{error}</p>}
      <Ready>
      <label>What do you need?<input className="field" value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} required maxLength={100} /></label>
      <label>Details<textarea className="field" style={{ minHeight: 100, padding: 12 }} value={f.description} onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} required maxLength={2000} /></label>
      <label>Category<select className="field" value={f.category} onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))} required>
        <option value="" disabled>Choose</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label>City<select className="field" value={f.location} onChange={(e) => setF((p) => ({ ...p, location: e.target.value }))} required>
        {LOCATIONS.map((l) => <option key={l}>{l}</option>)}</select></label>
      <button className="btn" type="submit" disabled={busy}>{busy ? "Posting…" : "Post wanted item"}</button>
      </Ready>
    </form>
  );
}
