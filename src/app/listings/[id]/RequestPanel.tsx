"use client";
import { useState, useTransition } from "react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Ready } from "@/components/Ready";
import { acceptRequest, fallThrough, markStatus, rejectRequest, sendRequest, withdrawRequest } from "./actions";

export type Req = { id: string; seeker_id: string; seekerName: string; message: string; offered_items: string | null; status: string };
export type Contact = { name: string; email: string; teams_handle: string | null } | null;
type Props = {
  listingId: string; type: string; status: string; role: "owner" | "seeker" | "other";
  requests: Req[]; myRequest: Req | null; contact: Contact;
};

export function RequestPanel(p: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [offered, setOffered] = useState("");
  const act = async (f: () => Promise<{ error?: string }>) => { setError((await f()).error ?? null); };
  const run = (f: () => Promise<{ error?: string }>) => start(() => act(f));
  const live = p.status === "available" || p.status === "requested";
  const accepted = p.requests.find((r) => r.status === "accepted");

  const contactBox = p.contact && (
    <div className="card" role="status">
      <h2>Contact</h2>
      <p>{p.contact.name}<br />Teams: {p.contact.teams_handle}<br />Email: {p.contact.email}</p>
      <p className="muted">Arrange the handover directly. When it is done, the giver marks the item.</p>
    </div>
  );

  return (
    <section aria-label="Requests" style={{ marginTop: 24 }}>
      {error && <p className="error" role="alert">{error}</p>}

      {p.role === "other" && live && (
        <form className="card login" onSubmit={(e) => { e.preventDefault(); run(() => sendRequest(p.listingId, msg, offered)); }}>
          <Ready>
          <h2>Request this item</h2>
          <label>Message to the giver
            <textarea className="field" style={{ minHeight: 90, padding: 12 }} required maxLength={1000} value={msg} onChange={(e) => setMsg(e.target.value)} /></label>
          {p.type === "exchange" && <label>What you can offer in exchange<input className="field" maxLength={1000} value={offered} onChange={(e) => setOffered(e.target.value)} /></label>}
          <button className="btn" disabled={pending}>{pending ? "Sending…" : "Send request"}</button>
          </Ready>
        </form>
      )}

      {p.role === "seeker" && p.myRequest?.status === "pending" && (
        <div className="card">
          <p>You requested this item. The giver will respond.</p>
          <button className="btn secondary" disabled={pending} onClick={() => run(() => withdrawRequest(p.listingId, p.myRequest!.id))}>{pending ? "Withdrawing…" : "Withdraw request"}</button>
        </div>
      )}
      {p.role === "seeker" && p.myRequest?.status === "accepted" && <>
        <p className="card">Your request was accepted.</p>{contactBox}
      </>}

      {p.role === "owner" && live && (
        <div>
          <h2>Requests ({p.requests.filter((r) => r.status === "pending").length})</h2>
          {p.requests.filter((r) => r.status === "pending").map((r) => (
            <div key={r.id} className="card" style={{ marginBottom: 8 }}>
              <strong>{r.seekerName}</strong>
              <p style={{ whiteSpace: "pre-wrap" }}>{r.message}</p>
              {r.offered_items && <p>Offers: {r.offered_items}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <ConfirmButton primary label="Accept" busyLabel="Accepting…" disabled={pending} title={`Accept ${r.seekerName}'s request?`}
                  message={`You and ${r.seekerName} will see each other's contact details. Other pending requests will be declined.`} run={() => act(() => acceptRequest(p.listingId, r.id))} />
                <ConfirmButton label="Reject" busyLabel="Rejecting…" disabled={pending} title="Reject this request?"
                  message={`${r.seekerName} will be told the request was declined.`} run={() => act(() => rejectRequest(p.listingId, r.id))} />
              </div>
            </div>
          ))}
        </div>
      )}

      {p.role === "owner" && p.status === "accepted" && <>
        <p className="card">You accepted {accepted?.seekerName}.</p>{contactBox}
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {p.type === "lend"
            ? <button className="btn" disabled={pending} onClick={() => run(() => markStatus(p.listingId, "lent"))}>Mark as lent</button>
            : <button className="btn" disabled={pending} onClick={() => run(() => markStatus(p.listingId, "given"))}>Mark as given</button>}
          <ConfirmButton label="Deal fell through" busyLabel="Updating…" disabled={pending} title="Did the deal fall through?"
            message={`The item becomes Available again and ${accepted?.seekerName ?? "the requester"} is told. Contact details stop being shared.`} run={() => act(() => fallThrough(p.listingId))} />
        </div>
      </>}
      {p.role === "owner" && p.status === "lent" && <button className="btn" disabled={pending} onClick={() => run(() => markStatus(p.listingId, "returned"))}>Mark as returned</button>}
      {p.role === "owner" && p.status === "returned" && <button className="btn" disabled={pending} onClick={() => run(() => markStatus(p.listingId, "available"))}>List again</button>}
      {p.status === "given" && <p className="card">This item has been given. Thank you for reusing.</p>}
    </section>
  );
}
