import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { LOCATIONS } from "@/lib/listing";
import { PROFILE_ERRORS, safeNext, validateProfile, type ProfileError } from "@/lib/profile";
import { supabaseServer } from "@/lib/supabase/server";

async function save(form: FormData) {
  "use server";
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/");
  const name = String(form.get("name") ?? "").trim();
  const location = String(form.get("location") ?? "");
  const teams = String(form.get("teams_handle") ?? "").trim();
  const bad = validateProfile({ name, location, teams_handle: teams }, LOCATIONS);
  if (bad) redirect(`/profile?error=${bad}`);
  const { data, error } = await sb.from("profiles").update({ name, location, teams_handle: teams }).eq("id", user.id).select("id");
  // Zero rows updated means the profile row is missing: say so instead of pretending it saved.
  if (error || !data?.length) redirect(error ? "/profile?error=save" : "/profile?error=missing");
  const jar = await cookies();
  const next = safeNext(jar.get("reuse_next")?.value); // where they were heading before sign-in
  jar.delete("reuse_next");
  redirect(next);
}

export const metadata = { title: "Profile" };

export default async function Profile({ searchParams }: { searchParams: Promise<{ error?: string; welcome?: string }> }) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: p } = await sb.from("profiles").select("name,location,teams_handle").eq("id", user!.id).single();
  const { error, welcome } = await searchParams;
  return (
    <>
      <Nav />
      <main className="wrap hero">
        <h1>{welcome ? "Welcome! Complete your profile" : "Your profile"}</h1>
        {welcome && <p className="card" role="status">One quick step before you start: add your name, city and Slack email.</p>}
        <p className="muted">Name, city and Slack email are needed before you can post or request. Your Slack email is shown only to the person you are matched with.</p>
        <form action={save} className="card login" style={{ marginTop: 24 }}>
          {error && <p className="error" role="alert">{PROFILE_ERRORS[error as ProfileError] ?? PROFILE_ERRORS.save}</p>}
          <label>Name<input className="field" name="name" defaultValue={p?.name ?? ""} required /></label>
          <label>City
            <select className="field" name="location" defaultValue={p?.location ?? ""} required>
              <option value="" disabled>Choose</option>
              {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </label>
          <label>Slack email<input className="field" name="teams_handle" defaultValue={p?.teams_handle ?? ""} placeholder="name@rubicotech.com" required /></label>
          <button className="btn" type="submit">Save</button>
        </form>
      </main>
    </>
  );
}
