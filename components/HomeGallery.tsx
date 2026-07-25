"use client";
/* Homepage "Inside The Yard" slideshow. The photo list is resolved on the
   server and passed in, so the images are in the page from the first paint —
   no client-side probing of non-existent files. This component only handles
   the fade/auto-advance behaviour. */
import { useEffect, useRef, useState } from "react";

export default function HomeGallery({ sources }: { sources: string[] }) {
  const [idx, setIdx] = useState(0);
  const frontRef = useRef<HTMLImageElement>(null);
  const backRef = useRef<HTMLImageElement>(null);

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
