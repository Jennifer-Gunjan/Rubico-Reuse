import Link from "next/link";

export function Logo() {
  return (
    <Link className="logo" href="/" aria-label="Rubico ReUse home">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 19H4.8a1.8 1.8 0 0 1-1.6-2.6L5 13" />
        <path d="m11 19 3.5-6" />
        <path d="M15.5 4.7a1.8 1.8 0 0 1 3.1 0l1.7 3" />
        <path d="m17 8 3.3-.4-.9-3.2" />
        <path d="M11 5.2 8.7 3.6a1.8 1.8 0 0 0-2.7.6L4.3 7" />
        <path d="m9.2 9.7-.5-3.3-3.2.9" />
        <path d="M17 19h2.2a1.8 1.8 0 0 0 1.6-2.6L19 13.6" />
        <path d="m14.5 16.5-2.7 2.2 2.7 2.3" />
      </svg>
      <span>Rubico ReUse</span>
    </Link>
  );
}
