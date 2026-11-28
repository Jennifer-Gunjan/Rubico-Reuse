"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PhotoPicker } from "@/components/PhotoPicker";
import { Ready } from "@/components/Ready";
import { CATEGORIES, CONDITIONS, LOCATIONS, freePositions, type ListingInput } from "@/lib/listing";
import { extFor, photoUrl, uploadPhoto } from "@/lib/photo";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { reorderPhotos, updateListing } from "@/app/my/actions";

type Img = { id: string; storage_path: string; position: number };

export function EditForm({ id, uid, initial, images }: { id: string; uid: string; initial: ListingInput; images: Img[] }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [kept, setKept] = useState(images);
  const [files, setFiles] = useState<File[]>([]);
  const room = 4 - kept.length;
  const set = (k: keyof ListingInput, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await updateListing(id, f);
    if (r.error) return setError(r.error);
    const sb = supabaseBrowser();
    const gone = images.filter((i) => !kept.some((k) => k.id === i.id));
    if (gone.length) {
      await sb.from("listing_images").delete().in("id", gone.map((g) => g.id));
      await sb.storage.from("listing-images").remove(gone.map((g) => g.storage_path));
    }
    // Renumber what is left into the order shown, so the first photo is the cover and any
    // gap a deletion left is closed. New photos then fill the slots after them.
    if (kept.length) {
      const r = await reorderPhotos(id, kept.map((k) => k.id));
      if (r.error) return setError(r.error);
    }
    const slots = freePositions(kept.map((_, i) => i), files.length);
    let used = 0, failed = 0;
    for (const [n, file] of files.slice(0, slots.length).entries()) {
      if (await uploadPhoto(sb, `${uid}/${id}-${Date.now()}-${n}.${extFor(file)}`, file, id, slots[used])) used++; else failed++;
    }
    router.push(`/listings/${id}${failed ? "?photos=failed" : ""}`);
  }
  return (
    <form onSubmit={submit} className="card login">
      {error && <p className="error" role="alert">{error}</p>}
      <Ready>
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
      <fieldset style={{ border: 0, padding: 0 }}>
        <legend style={{ fontWeight: 600 }}>Photos ({kept.length + files.length} of 4)</legend>
        <div className="gallery">
          {kept.map((k, i) => (
            <div key={k.id}>
              <Image src={photoUrl(k.storage_path)} alt="" width={120} height={90} sizes="120px" style={{ objectFit: "cover" }} />
              {i === 0
                ? <span className="mono muted">Cover photo</span>
                : <button type="button" className="btn secondary"
                    onClick={() => setKept([k, ...kept.filter((x) => x.id !== k.id)])}>Make cover</button>}
              <button type="button" className="btn secondary" aria-label={`Remove photo ${i + 1}`}
                onClick={() => setKept(kept.filter((x) => x.id !== k.id))}>Remove</button>
            </div>
          ))}
        </div>
        <PhotoPicker files={files} setFiles={setFiles} max={room} onError={setError} />
      </fieldset>
      <p className="muted">The type of a listing cannot be changed.</p>
      <button className="btn" type="submit">Save changes</button>
      </Ready>
    </form>
  );
}
