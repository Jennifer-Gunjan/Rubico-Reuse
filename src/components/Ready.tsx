"use client";
import { useEffect, useState } from "react";

/** Keeps a form's fields disabled until the page has hydrated, so early typing is not wiped when React takes over. */
export function Ready({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return <fieldset className="ready" disabled={!ready}>{children}</fieldset>;
}
