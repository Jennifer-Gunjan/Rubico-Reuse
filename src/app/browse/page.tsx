import Link from "next/link";
import { ListingGrid } from "@/components/ListingGrid";
import { Nav } from "@/components/Nav";
import { CATEGORIES, LOCATIONS, TYPES } from "@/lib/listing";
import { liveListings } from "@/lib/public";
import { supabaseServer } from "@/lib/supabase/server";

type SP = { q?: string; category?: string; location?: string; type?: string };

export default async function Browse({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const items = await liveListings(await supabaseServer(), sp);
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
        {!items.length ? (
          <p className="card" style={{ marginTop: 24 }}>Nothing here yet. <Link href="/listings/new">Post the first item</Link>.</p>
        ) : <ListingGrid items={items} />}
      </main>
    </>
  );
}
