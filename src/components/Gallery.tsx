"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { photoUrl } from "@/lib/photo";

/** Thumbnails that open a larger view with previous/next, Escape to close and arrow keys. */
export function Gallery({ title, paths }: { title: string; paths: string[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(0);
  if (!paths.length) return null;
  const n = paths.length;
  const go = (d: number) => setI((x) => (x + d + n) % n);
  const alt = (k: number) => `${title}, photo ${k + 1} of ${n}`;
  return (
    <>
      <div className="gallery">
        {paths.map((p, k) => (
          <button key={p} type="button" className="thumbbtn" aria-label={`Enlarge photo ${k + 1} of ${n}`} onClick={() => { setI(k); ref.current?.showModal(); }}>
            <Image src={photoUrl(p)} alt={alt(k)} width={280} height={210} sizes="280px" style={{ objectFit: "cover", height: "auto" }} />
          </button>
        ))}
      </div>
      <dialog ref={ref} className="dialog viewer" aria-label={`${title} photos`}
        onKeyDown={(e) => { if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); }}
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <Image src={photoUrl(paths[i])} alt={alt(i)} width={900} height={675} sizes="(max-width: 900px) 100vw, 900px" style={{ width: "100%", height: "auto" }} />
        <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
          <span className="mono" role="status">Photo {i + 1} of {n}</span>
          <span className="row">
            {n > 1 && <button type="button" className="btn secondary" onClick={() => go(-1)}>Previous</button>}
            {n > 1 && <button type="button" className="btn secondary" onClick={() => go(1)}>Next</button>}
            <button type="button" className="btn" onClick={() => ref.current?.close()} autoFocus>Close</button>
          </span>
        </div>
      </dialog>
    </>
  );
}
