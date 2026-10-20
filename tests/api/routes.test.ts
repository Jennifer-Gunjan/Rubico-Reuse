import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// One fake Supabase client stands in for both the route helper and the middleware client.
const auth = {
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
};
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => ({ auth }) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth }) }));

import { GET as callback } from "@/app/auth/callback/route";
import { POST as signout } from "@/app/auth/signout/route";
import { middleware } from "@/middleware";

const req = (path: string, method = "GET") => new NextRequest(`https://reuse.test${path}`, { method });
const loc = (r: Response) => new URL(r.headers.get("location") ?? "", "https://reuse.test");
const user = (email: string) => auth.getUser.mockResolvedValue({ data: { user: { email } } });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "k";
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({});
});

describe("GET /auth/callback", () => {
  it("without a code goes back to login with an error", async () => {
    const r = await callback(req("/auth/callback"));
    expect(loc(r).pathname + loc(r).search).toBe("/?error=signin");
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it("a failed code exchange goes back to login", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: new Error("bad") });
    expect(loc(await callback(req("/auth/callback?code=abc"))).search).toBe("?error=signin");
  });
  it("a rubicotech.in user lands on Browse", async () => {
    user("a@rubicotech.in");
    expect(loc(await callback(req("/auth/callback?code=abc"))).pathname).toBe("/browse");
  });
  it("an outside-domain user is signed out and refused", async () => {
    user("a@gmail.com");
    const r = await callback(req("/auth/callback?code=abc"));
    expect(loc(r).search).toBe("?error=domain");
    expect(auth.signOut).toHaveBeenCalled();
  });
  it("a lookalike domain is refused", async () => {
    user("a@evil.rubicotech.com");
    expect(loc(await callback(req("/auth/callback?code=abc"))).search).toBe("?error=domain");
  });
});

describe("POST /auth/signout", () => {
  it("signs out and redirects home with 303", async () => {
    const r = await signout(req("/auth/signout", "POST"));
    expect(r.status).toBe(303);
    expect(loc(r).pathname).toBe("/");
    expect(auth.signOut).toHaveBeenCalled();
  });
});

describe("middleware", () => {
  it("sends anonymous visitors from protected pages to login", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    for (const p of ["/browse", "/my", "/profile", "/listings/new"]) {
      const r = await middleware(req(p));
      expect(loc(r).pathname, p).toBe("/");
    }
  });
  it("lets anonymous visitors see login and the callback", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    for (const p of ["/", "/auth/callback"]) expect((await middleware(req(p))).headers.get("location")).toBeNull();
  });
  it("lets an allowed user through", async () => {
    user("a@rubicotech.com");
    expect((await middleware(req("/browse"))).headers.get("location")).toBeNull();
  });
  it("signs out a logged-in user from a disallowed domain", async () => {
    user("a@gmail.com");
    const r = await middleware(req("/browse"));
    expect(loc(r).search).toBe("?error=domain");
    expect(auth.signOut).toHaveBeenCalled();
  });
  it("fails closed when Supabase is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(loc(await middleware(req("/browse"))).search).toBe("?error=config");
    expect((await middleware(req("/"))).headers.get("location")).toBeNull();
  });
});
