import Link from "next/link";
import { ListingGrid } from "@/components/ListingGrid";
import { Nav } from "@/components/Nav";
import { CATEGORIES, LOCATIONS, TYPES, cleanFilters } from "@/lib/listing";
import { liveListings } from "@/lib/public";
import { supabaseServer } from "@/lib/supabase/server";

type SP = { q?: string; category?: string; location?: string; type?: string };

export const metadata = { title: "Browse" };

export default async function Browse({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = cleanFilters(await searchParams);
  const filtered = Object.values(sp).some(Boolean);
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
          filtered
            ? <p className="card" style={{ marginTop: 24 }}>No items match your search. <Link href="/browse">Clear filters</Link>.</p>
            : <p className="card" style={{ marginTop: 24 }}>Nothing here yet. <Link href="/listings/new">Post the first item</Link>.</p>
        ) : <ListingGrid items={items} />}
      </main>
    </>
  );
}
