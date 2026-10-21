"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ready } from "@/components/Ready";
import { CATEGORIES, LOCATIONS, type WantedInput } from "@/lib/listing";
import { createWanted } from "./actions";

export function WantedForm({ defaultLocation }: { defaultLocation: string }) {
  const router = useRouter();
  const [f, setF] = useState<WantedInput>({ title: "", description: "", category: "", location: defaultLocation });
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await createWanted(f);
    if (r.error) return setError(r.error);
    router.push("/wanted");
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
      <button className="btn" type="submit">Post wanted item</button>
      </Ready>
    </form>
  );
}
