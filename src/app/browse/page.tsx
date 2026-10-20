import Link from "next/link";
import { Nav } from "@/components/Nav";
import { CATEGORIES, LOCATIONS, TYPES, cleanSearch } from "@/lib/listing";
import { photoUrl } from "@/lib/photo";
import { supabaseServer } from "@/lib/supabase/server";

type SP = { q?: string; category?: string; location?: string; type?: string };

export default async function Browse({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sb = await supabaseServer();
  let query = sb.from("listings")
    .select("id,title,type,category,location,asking_price,status,listing_images(storage_path,position)")
    .in("status", ["available", "requested"]).order("created_at", { ascending: false }).limit(60);
  const q = cleanSearch(sp.q ?? "");
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (sp.category) query = query.eq("category", sp.category);
  if (sp.location) query = query.eq("location", sp.location);
  if (sp.type) query = query.eq("type", sp.type);
  const { data: items } = await query;

  return (
    <>
      <Nav />
      <main className="wrap hero">
        <h1>Browse</h1>
        <form className="filters" role="search">
          <input className="field" name="q" defaultValue={sp.q} placeholder="Search items" aria-label="Search" />
          <select className="field" name="category" defaultValue={sp.category ?? ""} aria-label="Category">
            <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="field" name="location" defaultValue={sp.location ?? ""} aria-label="City">
            <option value="">Both cities</option>{LOCATIONS.map((l) => <option key={l}>{l}</option>)}
          </select>
          <select className="field" name="type" defaultValue={sp.type ?? ""} aria-label="Type">
            <option value="">All types</option>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn" type="submit">Search</button>
        </form>
        {!items?.length ? (
          <p className="card" style={{ marginTop: 24 }}>Nothing here yet. <Link href="/listings/new">Post the first item</Link>.</p>
        ) : (
          <ul className="grid">
            {items.map((l) => {
              const img = [...(l.listing_images ?? [])].sort((a, b) => a.position - b.position)[0];
              return (
                <li key={l.id} className="card tile">
                  <Link href={`/listings/${l.id}`}>
                    {img ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={photoUrl(img.storage_path)} alt="" /> : <div className="noimg mono">No photo</div>}
                    <h2>{l.title}</h2>
                  </Link>
                  <p className="mono muted">{l.category} · {l.location}</p>
                  <p><span className="badge"><i className={l.status === "requested" ? "dot hot" : "dot"} />{l.status === "requested" ? "Requested" : "Available"}</span>{" "}
                    {TYPES[l.type as keyof typeof TYPES]}{l.type === "sell" && ` · ₹${l.asking_price}`}</p>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
