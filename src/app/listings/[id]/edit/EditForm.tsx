"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES, CONDITIONS, LOCATIONS, type ListingInput } from "@/lib/listing";
import { updateListing } from "@/app/my/actions";

export function EditForm({ id, initial }: { id: string; initial: ListingInput }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof ListingInput, v: string | boolean) => setF({ ...f, [k]: v });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await updateListing(id, f);
    if (r.error) return setError(r.error);
    router.push(`/listings/${id}`);
  }
  return (
    <form onSubmit={submit} className="card login">
      {error && <p className="error" role="alert">{error}</p>}
      <label>Title<input className="field" value={f.title} onChange={(e) => set("title", e.target.value)} required maxLength={100} /></label>
      <label>Description<textarea className="field" style={{ minHeight: 120, padding: 12 }} value={f.description} onChange={(e) => set("description", e.target.value)} required maxLength={2000} /></label>
      <label>Category<select className="field" value={f.category} onChange={(e) => set("category", e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label>Condition<select className="field" value={f.condition} onChange={(e) => set("condition", e.target.value)}>{Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      {f.type === "sell" && <>
        <label>Asking price (INR)<input className="field" type="number" min="0" value={f.asking_price ?? ""} onChange={(e) => set("asking_price", e.target.value)} required /></label>
        <label><input type="checkbox" checked={!!f.negotiable} onChange={(e) => set("negotiable", e.target.checked)} /> Price is negotiable</label>
      </>}
      {f.type === "exchange" && <label>What would you like in return?<input className="field" value={f.wanted_in_return ?? ""} onChange={(e) => set("wanted_in_return", e.target.value)} /></label>}
      {f.type === "lend" && <label>For how long?<input className="field" value={f.lend_duration_text ?? ""} onChange={(e) => set("lend_duration_text", e.target.value)} /></label>}
      <label>City<select className="field" value={f.location} onChange={(e) => set("location", e.target.value)}>{LOCATIONS.map((l) => <option key={l}>{l}</option>)}</select></label>
      <p className="muted">The type of a listing cannot be changed. Photos are fixed after posting for now.</p>
      <button className="btn" type="submit">Save changes</button>
    </form>
  );
}
