import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { supabaseServer } from "@/lib/supabase/server";
import { WantedForm } from "../WantedForm";

export default async function NewWanted() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: p } = await sb.from("profiles").select("name,location,teams_handle").eq("id", user!.id).single();
  if (!p?.name || !p.location || !p.teams_handle) redirect("/profile");
  return (
    <>
      <Nav />
      <main className="wrap hero"><h1>Post a wanted item</h1><WantedForm defaultLocation={p.location} /></main>
    </>
  );
}
