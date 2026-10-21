import Image from "next/image";
import Link from "next/link";
import { CATEGORY_ICON, CONDITIONS, priceLabel, timeAgo } from "@/lib/listing";
import { photoUrl } from "@/lib/photo";
import type { Tile } from "@/lib/public";

export function ListingGrid({ items }: { items: Tile[] }) {
  return (
    <ul className="grid">
      {items.map((l) => (
        <li key={l.id} className="card tile">
          <Link href={`/listings/${l.id}`}>
            <div className="imgbox">
              {l.image
                ? <Image src={photoUrl(l.image)} alt="" fill sizes="(max-width: 640px) 100vw, 260px" style={{ objectFit: "cover" }} />
                : <span className="icon" aria-hidden="true">{CATEGORY_ICON[l.category] ?? "📦"}</span>}
            </div>
            <h2>{l.title}</h2>
          </Link>
          <p className="price">{priceLabel(l.type, l.asking_price)}</p>
          <p className="mono muted">{CONDITIONS[l.condition as keyof typeof CONDITIONS]} · {l.category} · {l.location} · {timeAgo(l.created_at)}</p>
          <p><span className="badge"><i className={l.status === "requested" ? "dot hot" : "dot"} />{l.status === "requested" ? "Requested" : "Available"}</span></p>
        </li>
      ))}
    </ul>
  );
}
