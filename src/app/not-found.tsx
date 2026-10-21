import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="wrap hero">
        <h1>Not found</h1>
        <p className="lead">That page or item does not exist, or it is no longer available.</p>
        <p><Link className="btn" href="/browse">Browse items</Link></p>
      </main>
    </>
  );
}
