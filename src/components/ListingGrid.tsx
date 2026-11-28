import { Fragment } from "react";
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
          {/* The whole card is the link. Previously only the photo and title were, so
              clicking the price, the details or the status did nothing - the clickable area
              was smaller than the thing that looks clickable. There are no controls inside a
              card, so nothing is nested inside the link. */}
          <Link href={`/listings/${l.id}`} className="tilelink">
            <div className="imgbox">
              {l.image
                ? <Image src={photoUrl(l.image)} alt={l.title} fill sizes="(max-width: 640px) 100vw, 260px" style={{ objectFit: "cover" }} />
                : <span className="icon" aria-hidden="true">{CATEGORY_ICON[l.category] ?? "📦"}</span>}
            </div>
            <h2>{l.title}</h2>
            <p className="price">{priceLabel(l.type, l.asking_price)}</p>
            {/* The separator is glued to the fact before it and the space after it is left
                breakable, so the line wraps between facts and never starts one with a stray
                "·". Keeping the space inside the span would stop it wrapping at all. */}
            <p className="mono muted">
              {[CONDITIONS[l.condition as keyof typeof CONDITIONS], l.category, l.location, timeAgo(l.created_at)]
                .map((part, i, all) => (
                  <Fragment key={part}>
                    <span className="seg">{part}{i < all.length - 1 ? " ·" : ""}</span>
                    {i < all.length - 1 ? " " : ""}
                  </Fragment>
                ))}
            </p>
            <p><span className="badge"><i className={l.status === "requested" ? "dot hot" : "dot"} />{l.status === "requested" ? "Requested" : "Available"}</span></p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
