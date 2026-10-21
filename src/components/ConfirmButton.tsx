"use client";
import { useId, useRef, useState, useTransition } from "react";

/** A button that asks "are you sure?" in a native dialog (keyboard and screen-reader friendly) before running `run`. */
export function ConfirmButton({ label, busyLabel, title, message, confirmLabel, run, primary, disabled }: {
  label: string; busyLabel?: string; title: string; message: string; confirmLabel?: string;
  run: () => unknown | Promise<unknown>; primary?: boolean; disabled?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button type="button" className={primary ? "btn" : "btn secondary"} disabled={disabled || pending} onClick={() => ref.current?.showModal()}>
        {pending ? busyLabel ?? "Working…" : label}
      </button>
      <dialog ref={ref} className="dialog" aria-labelledby={id}>
        <h2 id={id}>{title}</h2>
        <p>{message}</p>
        <div className="row">
          <button type="button" className="btn secondary" onClick={() => ref.current?.close()} autoFocus>Cancel</button>
          <button type="button" className="btn" onClick={() => { ref.current?.close(); start(async () => { const r = await run(); setErr((r as { error?: string } | undefined)?.error ?? null); }); }}>{confirmLabel ?? label}</button>
        </div>
      </dialog>
      {err && <p className="error" role="alert">{err}</p>}
    </>
  );
}
