// Runs against the real Supabase project. Skipped unless the four LIVE_* variables are set (CI sets them from secrets).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { LIVE_SUPABASE_URL: url, LIVE_SUPABASE_ANON_KEY: key, LIVE_TEST_EMAIL: email, LIVE_TEST_PASSWORD: password } = process.env;
const live = !!(url && key && email && password);

describe.skipIf(!live)("live API", () => {
  let anon: SupabaseClient, me: SupabaseClient, uid: string;
  const made: string[] = [];

  beforeAll(async () => {
    anon = createClient(url!, key!);
    me = createClient(url!, key!);
    const { data, error } = await me.auth.signInWithPassword({ email: email!, password: password! });
    if (error) throw new Error(`Test user cannot sign in: ${error.message}`);
    uid = data.user.id;
    const { error: pe } = await me.from("profiles").update({ name: "CI Test", location: "Dehradun", teams_handle: "ci-test" }).eq("id", uid);
    if (pe) throw pe;
  });

  afterAll(async () => {
    for (const id of made) await me.rpc("close_listing", { p_listing: id }); // closed listings are hidden from Browse
  });

  it("anonymous users cannot read listings or profiles", async () => {
    const l = await anon.from("listings").select("id").limit(1);
    const p = await anon.from("profiles").select("id").limit(1);
    expect(l.data ?? []).toEqual([]);
    expect(p.data ?? []).toEqual([]);
  });

  it("anonymous users cannot call request functions", async () => {
    const r = await anon.rpc("create_request", { p_listing: "00000000-0000-0000-0000-000000000000", p_message: "hi" });
    expect(r.error).not.toBeNull();
  });

  it("a signed-in user sees only their own profile and the people they are matched with", async () => {
    // Allowed: yourself, the other party of an accepted request, and responders to your wanted posts. Nobody else.
    const { data: reqs } = await me.from("requests").select("seeker_id,status,listings(owner_id)").eq("status", "accepted");
    const { data: resp } = await me.from("wanted_responses").select("responder_id");
    const allowed = new Set<string>([uid, ...(resp ?? []).map((r) => r.responder_id)]);
    for (const r of (reqs ?? []) as unknown as { seeker_id: string; listings: { owner_id: string } | null }[]) {
      allowed.add(r.seeker_id);
      if (r.listings) allowed.add(r.listings.owner_id);
    }
    const { data } = await me.from("profiles").select("id");
    expect((data ?? []).filter((r) => !allowed.has(r.id))).toEqual([]);
    expect(data?.map((r) => r.id)).toContain(uid);
  });

  it("a user cannot make themselves admin or change their email", async () => {
    expect((await me.from("profiles").update({ role: "admin" }).eq("id", uid)).error).not.toBeNull();
    expect((await me.from("profiles").update({ email: "x@rubicotech.com" }).eq("id", uid)).error).not.toBeNull();
  });

  it("post, edit, close and relist a listing", async () => {
    const ins = await me.from("listings").insert({
      owner_id: uid, title: "[CI test] desk", description: "automated test item", category: "Furniture",
      condition: "good", type: "donate", location: "Dehradun",
    }).select("id,status").single();
    expect(ins.error).toBeNull();
    const id = ins.data!.id as string;
    made.push(id);
    expect(ins.data!.status).toBe("available");

    expect((await me.from("listings").update({ title: "[CI test] desk v2" }).eq("id", id)).error).toBeNull();
    expect((await me.from("listings").update({ type: "sell", asking_price: 5 }).eq("id", id)).error).not.toBeNull();
    expect((await me.rpc("close_listing", { p_listing: id })).error).toBeNull();
    expect((await me.from("listings").select("status").eq("id", id).single()).data?.status).toBe("closed");
    expect((await me.from("listings").update({ status: "available" }).eq("id", id)).error).toBeNull();
    expect((await me.from("listings").select("status").eq("id", id).single()).data?.status).toBe("available");
  });

  it("you cannot request your own listing", async () => {
    const { data } = await me.from("listings").select("id").eq("owner_id", uid).eq("status", "available").limit(1).single();
    const r = await me.rpc("create_request", { p_listing: data!.id, p_message: "mine" });
    expect(r.error).not.toBeNull();
  });
});
