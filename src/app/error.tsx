"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wrap hero">
      <h1>Something went wrong</h1>
      <p className="lead">This page could not load. Your data is safe. Try again, and if it keeps happening tell the product owner.</p>
      <p><button className="btn" onClick={reset}>Try again</button> <a className="btn secondary" href="/browse">Go to Browse</a></p>
    </main>
  );
}
