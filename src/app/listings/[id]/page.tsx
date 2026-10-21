import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { CONDITIONS, TYPES } from "@/lib/listing";
import { photoUrl } from "@/lib/photo";
import { supabaseServer } from "@/lib/supabase/server";
import { RequestPanel, type Req } from "./RequestPanel";

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await supabaseServer();
  const { data: l } = await sb.from("listings").select("*, listing_images(storage_path,position)").eq("id", id).maybeSingle();
  if (!l) notFound();
  const { data: owner } = await sb.from("profile_cards").select("name,location").eq("id", l.owner_id).maybeSingle();
  const { data: { user } } = await sb.auth.getUser();
  const uid = user!.id;
  const role = l.owner_id === uid ? "owner" : "seeker";
  const { data: reqRows } = await sb.from("requests").select("id,seeker_id,message,offered_items,status").eq("listing_id", id).order("created_at");
  const ids = [...new Set((reqRows ?? []).map((r) => r.seeker_id))];
  const { data: cards } = ids.length ? await sb.from("profile_cards").select("id,name").in("id", ids) : { data: [] };
  const requests: Req[] = (reqRows ?? []).map((r) => ({ ...r, seekerName: cards?.find((c) => c.id === r.seeker_id)?.name || "A colleague" }));
  const myRequest = requests.find((r) => r.seeker_id === uid && ["pending", "accepted"].includes(r.status)) ?? null;
  const acceptedReq = requests.find((r) => r.status === "accepted");
  // RLS only returns the counterpart's profile while an accepted request links the two of you.
  const contactId = role === "owner" ? acceptedReq?.seeker_id : myRequest?.status === "accepted" ? l.owner_id : undefined;
  const { data: contact } = contactId ? await sb.from("profiles").select("name,email,teams_handle").eq("id", contactId).maybeSingle() : { data: null };
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
        <p className="muted">Posted by {owner?.name || "a Rubico colleague"}. Status: {l.status}.</p>
        <RequestPanel listingId={id} type={l.type} status={l.status} role={role === "owner" ? "owner" : myRequest ? "seeker" : "other"} requests={role === "owner" ? requests : []} myRequest={myRequest} contact={contact} />
      </main>
    </>
  );
}
