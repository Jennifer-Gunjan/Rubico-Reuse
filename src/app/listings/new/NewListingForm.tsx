"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PhotoPicker } from "@/components/PhotoPicker";
import { Ready } from "@/components/Ready";
import { CATEGORIES, CONDITIONS, LOCATIONS, TYPES, type ListingInput } from "@/lib/listing";
import { extFor, uploadPhoto } from "@/lib/photo";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { createListing } from "./actions";

export function NewListingForm({ uid, defaultLocation }: { uid: string; defaultLocation: string }) {
  const router = useRouter();
  const [f, setF] = useState<ListingInput>({ title: "", description: "", category: "", condition: "", type: "donate", location: defaultLocation, negotiable: false });
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sent = useRef(false);
  const set = (k: keyof ListingInput, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sent.current) return; // a ref blocks a second click that lands before the re-render
    sent.current = true; setBusy(true); setError(null);
    const res = await createListing(f);
    if (!res.id) { sent.current = false; setBusy(false); return setError(res.error ?? "Could not post."); }
    const sb = supabaseBrowser();
    let pos = 0, failed = 0; // positions stay 0,1,2.. so the first photo that works is always the cover
    for (const [i, file] of files.entries()) {
      if (await uploadPhoto(sb, `${uid}/${res.id}-${i}.${extFor(file)}`, file, res.id, pos)) pos++; else failed++;
    }
    router.push(`/listings/${res.id}${failed ? "?photos=failed" : ""}`);
  }

  return (
    <form onSubmit={submit} className="card login">
      {error && <p className="error" role="alert">{error}</p>}
      <Ready>
      <label>Title<input className="field" value={f.title} onChange={(e) => set("title", e.target.value)} required maxLength={100} /></label>
      <label>Description<textarea className="field" style={{ minHeight: 120, padding: 12 }} value={f.description} onChange={(e) => set("description", e.target.value)} required maxLength={2000} /></label>
      <label>Category
        <select className="field" value={f.category} onChange={(e) => set("category", e.target.value)} required>
          <option value="" disabled>Choose</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select></label>
      <label>Condition
        <select className="field" value={f.condition} onChange={(e) => set("condition", e.target.value)} required>
          <option value="" disabled>Choose</option>{Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></label>
      <label>Type
        <select className="field" value={f.type} onChange={(e) => set("type", e.target.value)}>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></label>
      {f.type === "sell" && <>
        <label>Asking price (INR)<input className="field" type="number" min="0" step="1" value={f.asking_price ?? ""} onChange={(e) => set("asking_price", e.target.value)} required /></label>
        <label><input type="checkbox" checked={!!f.negotiable} onChange={(e) => set("negotiable", e.target.checked)} /> Price is negotiable</label>
      </>}
      {f.type === "exchange" && <label>What would you like in return?<input className="field" value={f.wanted_in_return ?? ""} onChange={(e) => set("wanted_in_return", e.target.value)} /></label>}
      {f.type === "lend" && <label>For how long?<input className="field" value={f.lend_duration_text ?? ""} onChange={(e) => set("lend_duration_text", e.target.value)} placeholder="e.g. 2 weeks" /></label>}
      <label>City
        <select className="field" value={f.location} onChange={(e) => set("location", e.target.value)} required>
          <option value="" disabled>Choose</option>{LOCATIONS.map((l) => <option key={l}>{l}</option>)}
        </select></label>
      <PhotoPicker files={files} setFiles={setFiles} max={4} onError={setError} coverable />
      <button className="btn" type="submit" disabled={busy}>{busy ? (files.length ? "Posting and uploading photos…" : "Posting…") : "Post item"}</button>
      </Ready>
    </form>
  );
}
