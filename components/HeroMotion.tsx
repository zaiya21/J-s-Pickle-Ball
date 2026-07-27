"use client";
/* Wraps the hero content and toggles the `hero-play` class as the hero enters
   or leaves the viewport. All hero animations (logo, split-text headline,
   subtitle, buttons) are gated behind that class in CSS, so they replay every
   time you scroll back to the top — not just on first load.

   FAIL-SAFE: without the class (i.e. if JavaScript never runs) nothing is
   hidden, so the hero is simply visible. */
import { useEffect, useRef, useState, type ReactNode } from "react";

export default function HeroMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced motion: never animate, just show the hero.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => setPlay(e.isIntersecting)),
      { threshold: 0.25 }, // needs a decent part of the hero on screen
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`hero-inner ${play ? "hero-play" : ""}`.trim()}>
      {children}
    </div>
  );
}
