import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/domain";
import { profileComplete, safeNext } from "@/lib/profile";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { origin, searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/?error=signin`);

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/?error=signin`);

  const { data } = await supabase.auth.getUser();
  if (!isAllowedEmail(data.user?.email ?? "")) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/?error=domain`);
  }

  // Where they were heading before signing in (set by the login form), and whether they must finish their profile first.
  const next = safeNext(req.cookies.get("reuse_next")?.value);
  const { data: profile } = await supabase.from("profiles").select("name,location,teams_handle").eq("id", data.user!.id).maybeSingle();
  if (profileComplete(profile)) {
    const res = NextResponse.redirect(`${origin}${next}`);
    res.cookies.delete("reuse_next");
    return res;
  }
  return NextResponse.redirect(`${origin}/profile?welcome=1`); // keeps the cookie so the profile page can send them on afterwards
}
