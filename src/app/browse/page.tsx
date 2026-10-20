import { Logo } from "@/components/Logo";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Browse() {
  const { data } = await (await supabaseServer()).auth.getUser();
  return (
    <>
      <header className="nav">
        <div className="wrap">
          <Logo />
          <form action="/auth/signout" method="post">
            <button className="btn secondary" type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <main className="wrap hero">
        <h1>Browse</h1>
        <p className="muted">Signed in as {data.user?.email}. Listings arrive on Day 2.</p>
      </main>
    </>
  );
}
