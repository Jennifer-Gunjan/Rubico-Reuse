import Link from "next/link";
import { redirect } from "next/navigation";
import { ListingGrid } from "@/components/ListingGrid";
import { Logo } from "@/components/Logo";
import { safeNext } from "@/lib/profile";
import { liveListings } from "@/lib/public";
import { supabaseServer } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

const ERRORS: Record<string, string> = {
  domain: "Only @rubicotech.com and @rubicotech.in accounts can sign in.",
  signin: "Sign-in did not complete. Please try again.",
  config: "The app is not configured yet.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (user && !error) redirect(safeNext(next));
  const items = await liveListings(sb, { limit: 8 });
  return (
    <>
      <header className="nav"><div className="wrap"><Logo /></div></header>
      <main className="wrap hero">
        <h1>Give things a second life, inside Rubico.</h1>
        <p className="lead">Donate, exchange, sell or lend what you no longer need. Ask for what you are looking for.</p>
        <section className="card" aria-labelledby="signin" style={{ marginTop: 32 }}>
          <h2 id="signin">Sign in to request, post or message</h2>
          {error && <p className="error" role="alert">{ERRORS[error] ?? ERRORS.signin}</p>}
          <LoginForm next={next ? safeNext(next, "") || undefined : undefined} />
        </section>
        <h2 style={{ marginTop: 40 }}>Available now</h2>
        {items.length ? <ListingGrid items={items} /> : <p className="muted">Nothing listed yet.</p>}
        <p><Link href="/browse">Browse everything</Link></p>
      </main>
    </>
  );
}
