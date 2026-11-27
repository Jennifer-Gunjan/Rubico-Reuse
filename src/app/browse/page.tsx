import Link from "next/link";
import { ListingGrid } from "@/components/ListingGrid";
import { Nav } from "@/components/Nav";
import { CATEGORIES, LOCATIONS, TYPES, cleanFilters } from "@/lib/listing";
import { PAGE_SIZE, SORTS, cleanPage, cleanSort, countListings, liveListings } from "@/lib/public";
import { supabaseServer } from "@/lib/supabase/server";

type SP = { q?: string; category?: string; location?: string; type?: string; sort?: string; page?: string };

export const metadata = { title: "Browse" };

/** Keeps the current search on the link, changing only the page. */
function pageHref(sp: SP, page: number) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v && k !== "page") p.set(k, v);
  if (page > 1) p.set("page", String(page));
  const q = p.toString();
  return q ? `/browse?${q}` : "/browse";
}

export default async function Browse({ searchParams }: { searchParams: Promise<SP> }) {
  const raw = await searchParams;
  const sp = cleanFilters(raw);
  const sort = cleanSort(raw.sort);
  const page = cleanPage(raw.page);
  const filtered = Object.values(sp).some(Boolean);

  const sb = await supabaseServer();
  const [items, total] = await Promise.all([
    liveListings(sb, { ...sp, sort, page }),
    countListings(sb, sp),
  ]);

  const lastPage = total === null ? page : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = (page - 1) * PAGE_SIZE + 1;

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
          <select className="field" name="sort" defaultValue={sort} aria-label="Sort by">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn" type="submit">Search</button>
        </form>

        {total !== null && !!total && (
          <p className="mono muted" role="status">
            {total === 1 ? "1 item" : `${total} items`}
            {total > PAGE_SIZE && ` · showing ${first} to ${first + items.length - 1}`}
          </p>
        )}

        {!items.length ? (
          filtered
            ? <p className="card" style={{ marginTop: 24 }}>No items match your search. <Link href="/browse">Clear filters</Link>.</p>
            : <p className="card" style={{ marginTop: 24 }}>Nothing here yet. <Link href="/listings/new">Post the first item</Link>.</p>
        ) : <ListingGrid items={items} />}

        {lastPage > 1 && (
          <nav className="pager" aria-label="Pages">
            {page > 1
              ? <Link className="btn secondary" href={pageHref(raw, page - 1)} rel="prev">Previous</Link>
              : <span />}
            <span className="mono muted">Page {page} of {lastPage}</span>
            {page < lastPage
              ? <Link className="btn secondary" href={pageHref(raw, page + 1)} rel="next">Next</Link>
              : <span />}
          </nav>
        )}
      </main>
    </>
  );
}
