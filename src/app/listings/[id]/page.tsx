import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { CONDITIONS, TYPES } from "@/lib/listing";
import { photoUrl } from "@/lib/photo";
import { supabaseServer } from "@/lib/supabase/server";

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await supabaseServer();
  const { data: l } = await sb.from("listings").select("*, listing_images(storage_path,position)").eq("id", id).maybeSingle();
  if (!l) notFound();
  const { data: owner } = await sb.from("profile_cards").select("name,location").eq("id", l.owner_id).maybeSingle();
  const imgs = [...(l.listing_images ?? [])].sort((a: { position: number }, b: { position: number }) => a.position - b.position);
  return (
    <>
      <Nav />
      <main className="wrap hero">
        <h1>{l.title}</h1>
        <p className="mono muted">{l.category} · {l.location} · {CONDITIONS[l.condition as keyof typeof CONDITIONS]} · {TYPES[l.type as keyof typeof TYPES]}</p>
        {l.type === "sell" && <p><strong>₹{l.asking_price}</strong>{l.negotiable && " (negotiable)"}</p>}
        {l.wanted_in_return && <p>Wanted in return: {l.wanted_in_return}</p>}
        {l.lend_duration_text && <p>Lent for: {l.lend_duration_text}</p>}
        <div className="gallery">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {imgs.map((i: { storage_path: string }) => <img key={i.storage_path} src={photoUrl(i.storage_path)} alt={l.title} />)}
        </div>
        <p style={{ whiteSpace: "pre-wrap" }}>{l.description}</p>
        <p className="muted">Posted by {owner?.name || "a Rubico colleague"}. Status: {l.status}. Requests arrive on Day 3.</p>
      </main>
    </>
  );
}
