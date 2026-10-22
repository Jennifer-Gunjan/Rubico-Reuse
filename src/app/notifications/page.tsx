import Link from "next/link";
import { Nav } from "@/components/Nav";
import { supabaseServer } from "@/lib/supabase/server";
import { markAllRead } from "./actions";

export const metadata = { title: "Notifications" };

export default async function Notifications() {
  const sb = await supabaseServer();
  const { data } = await sb.from("notifications").select("id,type,message,payload,read_at,created_at").order("created_at", { ascending: false }).limit(50);
  return (
    <>
      <Nav />
      <main className="wrap hero">
        <h1>Notifications</h1>
        {!data?.length ? <p className="card">Nothing yet.</p> : <>
          <form action={markAllRead}><button className="btn secondary">Mark all as read</button></form>
          <ul className="grid" style={{ gridTemplateColumns: "1fr", marginTop: 16 }}>
            {data.map((n) => (
              <li key={n.id} className="card">
                <p style={{ margin: 0, fontWeight: n.read_at ? 400 : 700 }}>
                  {n.payload?.listing_id ? <Link href={`/listings/${n.payload.listing_id}`}>{n.message}</Link>
                    : n.type === "wanted_response" ? <Link href="/wanted">{n.message}</Link> : n.message}
                </p>
                <p className="mono muted" style={{ margin: 0 }}>{new Date(n.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
              </li>
            ))}
          </ul>
        </>}
      </main>
    </>
  );
}
