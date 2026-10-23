export default function Loading() {
  return (
    <main className="wrap hero loader" aria-busy="true">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only" role="status">Loading</span>
    </main>
  );
}
