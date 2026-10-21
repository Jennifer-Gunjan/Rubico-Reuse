"use client";
import { useEffect, useMemo } from "react";
import { okPhoto } from "@/lib/photo";

/** Adds photos with thumbnails, a remove button and (optionally) "make cover". `max` is how many more may be added. */
export function PhotoPicker({ files, setFiles, max, onError, coverable }: {
  files: File[]; setFiles: (f: File[]) => void; max: number; onError: (m: string | null) => void; coverable?: boolean;
}) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  function add(input: HTMLInputElement) {
    const chosen = Array.from(input.files ?? []);
    input.value = ""; // lets the same file be picked again after removing it
    if (files.length + chosen.length > max) return onError(`You can add ${max === 1 ? "1 more photo" : `up to ${max} photos`}.`);
    if (!chosen.every(okPhoto)) return onError("Photos must be JPG or PNG, 2 MB or less.");
    onError(null);
    setFiles([...files, ...chosen]);
  }

  return (
    <div>
      {files.length > 0 && (
        <ul className="thumbs" aria-label="Photos to upload">
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}-${i}`} className="thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls[i]} alt={`Photo ${i + 1}: ${f.name}`} />
              {coverable && <span className="mono muted">{i === 0 ? "Cover photo" : ""}</span>}
              {coverable && i > 0 && <button type="button" className="btn secondary" onClick={() => setFiles([f, ...files.filter((_, j) => j !== i)])}>Make cover</button>}
              <button type="button" className="btn secondary" aria-label={`Remove photo ${i + 1}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      {files.length < max && (
        <label>Add photos (JPG or PNG, 2 MB each)
          <input type="file" accept="image/jpeg,image/png" multiple onChange={(e) => add(e.target)} /></label>
      )}
    </div>
  );
}
