import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/domain";

const PUBLIC = ["/", "/auth/callback"];

export async function middleware(req: NextRequest) {
  const isPublic = PUBLIC.includes(req.nextUrl.pathname);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const home = (error?: string) => {
    const to = req.nextUrl.clone();
    to.pathname = "/";
    to.search = error ? `?error=${error}` : "";
    return NextResponse.redirect(to);
  };

  if (!url || !key) return isPublic ? NextResponse.next() : home("config"); // fail closed

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (data.user && !isAllowedEmail(email ?? "")) {
    await supabase.auth.signOut(); // second lock behind the database trigger
    return home("domain");
  }
  if (!data.user && !isPublic) return home();
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
