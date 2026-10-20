import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { supabaseServer } from "@/lib/supabase/server";
import { NewListingForm } from "./NewListingForm";

export default async function NewListing() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: p } = await sb.from("profiles").select("name,location,teams_handle").eq("id", user!.id).single();
  if (!p?.name || !p.location || !p.teams_handle) redirect("/profile");
  return (
    <>
      <Nav />
      <main className="wrap hero">
        <h1>Post an item</h1>
        <NewListingForm uid={user!.id} defaultLocation={p.location} />
      </main>
    </>
  );
}
