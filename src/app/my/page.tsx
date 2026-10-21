import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Nav } from "@/components/Nav";
import { TYPES } from "@/lib/listing";
import { supabaseServer } from "@/lib/supabase/server";
import { closeListing, reopenListing } from "./actions";

export default async function My() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: items } = await sb.from("listings").select("id,title,type,status").eq("owner_id", user!.id).order("created_at", { ascending: false });
  return (
    <>
      <Nav />
      <main className="wrap hero">
        <h1>My items</h1>
        {!items?.length && <p className="card">You have not posted anything yet. <Link href="/listings/new">Post an item</Link>.</p>}
        <ul className="grid">
          {items?.map((l) => (
            <li key={l.id} className="card tile">
              <Link href={`/listings/${l.id}`}><h2>{l.title}</h2></Link>
              <p className="mono muted">{TYPES[l.type as keyof typeof TYPES]} · {l.status}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["available", "requested", "returned"].includes(l.status) && <Link className="btn secondary" href={`/listings/${l.id}/edit`}>Edit</Link>}
                {["available", "requested"].includes(l.status) && <ConfirmButton label="Close" busyLabel="Closing…" title="Close this listing?" message="It leaves Browse and pending requests are declined. You can relist it later." run={closeListing.bind(null, l.id)} />}
                {l.status === "closed" && <ActionButton label="Relist" busyLabel="Relisting…" run={reopenListing.bind(null, l.id)} />}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
