import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Logo } from "./Logo";

export async function Nav() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return (
      <header className="nav">
        <div className="wrap">
          <Logo />
          <nav className="navlinks" aria-label="Main">
            <Link href="/browse">Browse</Link>
            <Link className="btn" href="/">Sign in</Link>
          </nav>
        </div>
      </header>
    );
  }
  const { count } = await sb.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return (
    <header className="nav">
      <div className="wrap">
        <Logo />
        <nav className="navlinks" aria-label="Main">
          <Link href="/browse">Browse</Link>
          <Link href="/wanted">Wanted</Link>
          <Link href="/my">My items</Link>
          <Link href="/notifications">Notifications{count ? ` (${count})` : ""}</Link>
          <Link href="/profile">Profile</Link>
          <Link className="btn" href="/listings/new">Post an item</Link>
          <form action="/auth/signout" method="post"><button className="btn secondary" type="submit">Sign out</button></form>
        </nav>
      </div>
    </header>
  );
}
