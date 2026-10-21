import Image from "next/image";
import Link from "next/link";
import { TYPES } from "@/lib/listing";
import { photoUrl } from "@/lib/photo";
import type { Tile } from "@/lib/public";

export function ListingGrid({ items }: { items: Tile[] }) {
  return (
    <ul className="grid">
      {items.map((l) => (
        <li key={l.id} className="card tile">
          <Link href={`/listings/${l.id}`}>
            <div className="imgbox">
              {l.image ? <Image src={photoUrl(l.image)} alt="" fill sizes="(max-width: 640px) 100vw, 260px" style={{ objectFit: "cover" }} /> : <span className="mono muted">No photo</span>}
            </div>
            <h2>{l.title}</h2>
          </Link>
          <p className="mono muted">{l.category} · {l.location}</p>
          <p><span className="badge"><i className={l.status === "requested" ? "dot hot" : "dot"} />{l.status === "requested" ? "Requested" : "Available"}</span>{" "}
            {TYPES[l.type as keyof typeof TYPES]}{l.type === "sell" && ` · ₹${l.asking_price}`}</p>
        </li>
      ))}
    </ul>
  );
}
