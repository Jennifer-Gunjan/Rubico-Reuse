import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { supabaseServer } from "@/lib/supabase/server";
import { EditForm } from "./EditForm";

export default async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: l } = await sb.from("listings").select("*, listing_images(id,storage_path,position)").eq("id", id).eq("owner_id", user!.id).maybeSingle();
  if (!l) notFound();
  return (
    <>
      <Nav />
      <main className="wrap hero">
        <h1>Edit item</h1>
        <EditForm id={id} uid={user!.id} images={l.listing_images ?? []} initial={{
          title: l.title, description: l.description, category: l.category, condition: l.condition, type: l.type,
          location: l.location, asking_price: l.asking_price?.toString() ?? "", negotiable: l.negotiable,
          wanted_in_return: l.wanted_in_return ?? "", lend_duration_text: l.lend_duration_text ?? "",
        }} />
      </main>
    </>
  );
}
