"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES, CONDITIONS, LOCATIONS, freePositions, type ListingInput } from "@/lib/listing";
import { photoUrl } from "@/lib/photo";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { updateListing } from "@/app/my/actions";

type Img = { id: string; storage_path: string; position: number };
const MAX = 2 * 1024 * 1024;

export function EditForm({ id, uid, initial, images }: { id: string; uid: string; initial: ListingInput; images: Img[] }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [kept, setKept] = useState(images);
  const [files, setFiles] = useState<File[]>([]);
  const room = 4 - kept.length;
  function pick(list: FileList | null) {
    const chosen = Array.from(list ?? []);
    if (chosen.length > room) return setError(`You can add ${room} more photo${room === 1 ? "" : "s"}.`);
    if (chosen.some((c) => !["image/jpeg", "image/png"].includes(c.type) || c.size > MAX)) return setError("Photos must be JPG or PNG, 2 MB or less.");
    setError(null); setFiles(chosen);
  }
  const set = (k: keyof ListingInput, v: string | boolean) => setF({ ...f, [k]: v });
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
    const slots = freePositions(kept.map((k) => k.position), files.length);
    for (const [n, file] of files.slice(0, slots.length).entries()) {
      const path = `${uid}/${id}-${Date.now()}-${n}.${file.type === "image/png" ? "png" : "jpg"}`;
      const up = await sb.storage.from("listing-images").upload(path, file, { contentType: file.type });
      if (!up.error) await sb.from("listing_images").insert({ listing_id: id, storage_path: path, position: slots[n] });
    }
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
      <fieldset style={{ border: 0, padding: 0 }}>
        <legend style={{ fontWeight: 600 }}>Photos ({kept.length + files.length} of 4)</legend>
        <div className="gallery">
          {kept.map((k) => (
            <div key={k.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(k.storage_path)} alt="" style={{ width: 120 }} />
              <button type="button" className="btn secondary" onClick={() => setKept(kept.filter((x) => x.id !== k.id))}>Remove</button>
            </div>
          ))}
        </div>
        {room > 0 && <input type="file" accept="image/jpeg,image/png" multiple onChange={(e) => pick(e.target.files)} aria-label="Add photos" />}
      </fieldset>
      <p className="muted">The type of a listing cannot be changed.</p>
      <button className="btn" type="submit">Save changes</button>
    </form>
  );
}
