import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Logo } from "./Logo";

export async function Nav() {
  const { count } = await (await supabaseServer()).from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return (
    <header className="nav">
      <div className="wrap">
        <Logo />
        <nav style={{ display: "flex", gap: 16, alignItems: "center" }}>
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
