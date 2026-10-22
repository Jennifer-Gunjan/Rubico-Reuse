import Link from "next/link";
import { Nav } from "@/components/Nav";
import { CATEGORIES, LOCATIONS, cleanSearch } from "@/lib/listing";
import { supabaseServer } from "@/lib/supabase/server";
import { HaveThis } from "./HaveThis";

type SP = { q?: string; category?: string; location?: string };

export default async function Wanted({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  let query = sb.from("wanted_posts").select("id,poster_id,title,description,category,location").eq("status", "open").order("created_at", { ascending: false }).limit(60);
  const q = cleanSearch(sp.q ?? "");
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (sp.category) query = query.eq("category", sp.category);
  if (sp.location) query = query.eq("location", sp.location);
  const { data: posts } = await query;
  const { data: mine } = await sb.from("wanted_responses").select("wanted_id").eq("responder_id", user!.id);
  const responded = new Set((mine ?? []).map((r) => r.wanted_id));
  // Responses to the posts I made, with each responder's contact (the database lets a poster read exactly these profiles).
  const myIds = (posts ?? []).filter((w) => w.poster_id === user!.id).map((w) => w.id);
  const { data: resp } = myIds.length ? await sb.from("wanted_responses").select("wanted_id,responder_id,note,created_at").in("wanted_id", myIds).order("created_at") : { data: [] };
  const rids = [...new Set((resp ?? []).map((r) => r.responder_id))];
  const { data: people } = rids.length ? await sb.from("profiles").select("id,name,email,teams_handle,location").in("id", rids) : { data: [] };

  return (
    <>
      <Nav />
      <main className="wrap hero">
        <h1>Wanted</h1>
        <p><Link className="btn" href="/wanted/new">Post a wanted item</Link></p>
        <form className="filters" role="search" style={{ gridTemplateColumns: "2fr 1fr 1fr auto" }}>
          <input className="field" name="q" defaultValue={sp.q} placeholder="Search wanted items" aria-label="Search" />
          <select className="field" name="category" defaultValue={sp.category ?? ""} aria-label="Category"><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <select className="field" name="location" defaultValue={sp.location ?? ""} aria-label="City"><option value="">Both cities</option>{LOCATIONS.map((l) => <option key={l}>{l}</option>)}</select>
          <button className="btn" type="submit">Search</button>
        </form>
        {!posts?.length ? <p className="card">Nobody is looking for anything right now.</p> : (
          <ul className="grid">
            {posts.map((w) => (
              <li key={w.id} className="card tile">
                <h2>{w.title}</h2>
                <p className="mono muted">{w.category} · {w.location}</p>
                <p style={{ whiteSpace: "pre-wrap" }}>{w.description}</p>
                {w.poster_id === user!.id && (() => {
                  const rs = (resp ?? []).filter((r) => r.wanted_id === w.id);
                  return (
                    <section aria-label={`Responses to ${w.title}`}>
                      <h3 style={{ margin: "8px 0" }}>{rs.length ? `Responses (${rs.length})` : "No responses yet"}</h3>
                      {rs.map((r) => {
                        const p = people?.find((x) => x.id === r.responder_id);
                        return (
                          <div key={r.responder_id} className="card" style={{ marginBottom: 8, padding: 16 }}>
                            <strong>{p?.name || "A colleague"}</strong>{p?.location && <span className="muted"> · {p.location}</span>}
                            <p style={{ margin: "4px 0" }}>Teams: {p?.teams_handle ?? "not set"}<br />Email: {p?.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : "not available"}</p>
                            {r.note && <p style={{ margin: "4px 0", whiteSpace: "pre-wrap" }}>&ldquo;{r.note}&rdquo;</p>}
                          </div>
                        );
                      })}
                    </section>
                  );
                })()}
                <HaveThis id={w.id} mine={w.poster_id === user!.id} responded={responded.has(w.id)} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
