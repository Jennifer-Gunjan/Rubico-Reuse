import Link from "next/link";
import { Logo } from "./Logo";

export function Nav() {
  return (
    <header className="nav">
      <div className="wrap">
        <Logo />
        <nav style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/browse">Browse</Link>
          <Link href="/profile">Profile</Link>
          <Link className="btn" href="/listings/new">Post an item</Link>
          <form action="/auth/signout" method="post"><button className="btn secondary" type="submit">Sign out</button></form>
        </nav>
      </div>
    </header>
  );
}
