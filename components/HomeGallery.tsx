"use client";
/* Homepage "Inside The Yard" slideshow — ported from index.html's inline script.
   Gallery slot overrides come from Supabase; empty slots fall back to p{n}.jpg. */
import { useEffect, useRef, useState } from "react";
import { GALLERY_PLACEHOLDER } from "@/lib/helpers";

function tryLoadImage(cands: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    let k = 0;
    const img = new Image();
    img.onload = () => resolve(cands[k]);
    img.onerror = () => {
      k++;
      if (k < cands.length) img.src = cands[k];
      else resolve(null);
    };
    img.src = cands[0];
  });
}

export default function HomeGallery({ slots }: { slots: (string | null)[] }) {
  const [sources, setSources] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const frontRef = useRef<HTMLImageElement>(null);
  const backRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: string[] = [];
      for (let i = 0; i < 10; i++) {
        const ov = slots[i];
        if (ov) {
          out.push(ov);
          continue;
        }
        const n = i + 1;
        const src = await tryLoadImage([`/p${n}.jpg`, `/p${n}.png`, `/p${n}.jpeg`, `/p${n}.webp`]);
        if (src) out.push(src);
      }
      if (!alive) return;
      setSources(out.length ? out : [GALLERY_PLACEHOLDER]);
    })();
    return () => {
      alive = false;
    };
  }, [slots]);

  useEffect(() => {
    if (sources.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setInterval(() => goTo((idx + 1) % sources.length), 5000);
      return () => clearInterval(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, idx]);

  function goTo(n: number) {
    if (n === idx) return;
    const front = frontRef.current;
    const back = backRef.current;
    if (!front || !back) return;
    back.onload = () => {
      requestAnimationFrame(() => back.classList.add("show"));
      setTimeout(() => {
        front.src = back.src;
        back.classList.remove("show");
        setIdx(n);
      }, 1300);
    };
    back.src = sources[n];
  }

  if (!sources.length) return <div className="home-gallery" />;

  return (
    <div className="home-gallery">
      <div className="slideshow">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={frontRef} className="layer-front" src={sources[0]} alt="J's Pickle Yard court photo" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={backRef} className="layer-back" alt="" aria-hidden="true" />
        <div className="slide-dots">
          {sources.map((_, i) => (
            <button key={i} className={`dot ${i === idx ? "on" : ""}`} title={`Photo ${i + 1}`} onClick={() => goTo(i)} />
          ))}
        </div>
      </div>
    </div>
  );
}
