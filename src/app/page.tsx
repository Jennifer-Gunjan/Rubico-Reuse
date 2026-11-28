import Link from "next/link";
import { redirect } from "next/navigation";
import { ListingGrid } from "@/components/ListingGrid";
import { Logo } from "@/components/Logo";
import { safeNext } from "@/lib/profile";
import { liveCount, liveListings } from "@/lib/public";
import { supabaseServer } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";
import { SignInNotice } from "./SignInNotice";

// The preview grid below renders live item titles, so this page is kept out of search
// results for the same reason Browse is: those items belong to the colleagues who listed
// them. The page stays reachable by link, which is how people get here anyway.
export const metadata = { robots: { index: false, follow: false } };

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (user && !error) redirect(safeNext(next));
  const [items, total] = await Promise.all([liveListings(sb, { limit: 8 }), liveCount(sb)]);
  return (
    <>
      <header className="nav"><div className="wrap"><Logo /></div></header>
      <main className="wrap hero">
        <h1>Give things a second life, inside Rubico.</h1>
        <p className="lead">Donate, exchange, sell or lend what you no longer need. Ask for what you are looking for.</p>
        {!!total && <p className="mono muted">{total} {total === 1 ? "item" : "items"} available now in Haridwar and Dehradun</p>}
        <section className="card signin" aria-labelledby="signin" style={{ marginTop: 32 }}>
          <h2 id="signin">Sign in to request, post or message</h2>
          <SignInNotice code={error} />
          <LoginForm next={next ? safeNext(next, "") || undefined : undefined} />
        </section>
        <h2 style={{ marginTop: 40 }}>Available now</h2>
        {items.length ? <ListingGrid items={items} /> : <p className="muted">Nothing listed yet.</p>}
        <p><Link href="/browse">Browse everything</Link></p>
        <h2 style={{ marginTop: 40 }}>How it works</h2>
        <ol className="steps">
          <li className="card"><strong>1. Post or browse</strong><p>Share something you no longer need, or look through what colleagues have listed.</p></li>
          <li className="card"><strong>2. Request</strong><p>Ask for an item with a short message. The giver chooses who gets it.</p></li>
          <li className="card"><strong>3. Hand it over</strong><p>Once the giver accepts, you both see each other&apos;s contact details and arrange the hand-over.</p></li>
        </ol>
        <p className="muted">Anyone can browse. Posting, requesting and the Wanted board need a Rubico login (@rubicotech.com or @rubicotech.in). Contact details are shared only with the person you are matched with.</p>
      </main>
    </>
  );
}
