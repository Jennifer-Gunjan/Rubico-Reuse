import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/domain";
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
  return NextResponse.redirect(`${origin}/browse`);
}
