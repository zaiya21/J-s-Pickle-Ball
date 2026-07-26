"use client";
/* Scroll-reveal wrapper.

   FAIL-SAFE BY DESIGN: the server-rendered markup carries no hiding class, so
   if JavaScript never runs (or is slow) the content is simply visible. Only
   after JS confirms the element is BELOW the fold does it arm the hidden state
   and wait for the viewport — so a section can never end up stuck invisible,
   and there is never a flash of content disappearing.

   Motion values follow the ui-ux-pro-max guidance (see css/styles.css). */
import { useEffect, useRef, useState, type ReactNode } from "react";

export type RevealAnimation =
  | "up"        // rises and fades in
  | "zoom"      // scales up from slightly small
  | "left"      // slides in from the left
  | "right"     // slides in from the right
  | "flip"      // tilts forward into place
  | "stagger";  // children appear one after another

type Phase = "idle" | "armed" | "in";

export default function Reveal({
  animation = "up",
  delay = 0,
  className = "",
  children,
}: {
  animation?: RevealAnimation;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle"); // idle = plainly visible

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect the OS reduced-motion setting: stay visible, never animate.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // Already on screen when the page loads? Leave it visible — hiding it now
    // would cause a visible flicker, and the hero already animates on load.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    setPhase("armed"); // safe: the element is off-screen, so nobody sees it hide

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setPhase("in");
            io.unobserve(entry.target); // animate once
          }
        });
      },
      // matches GSAP ScrollTrigger start: "top 85%"
      { threshold: 0, rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);

    // Safety net: if anything goes wrong, reveal the content anyway.
    const failsafe = setTimeout(() => setPhase("in"), 4000);

    return () => {
      io.disconnect();
      clearTimeout(failsafe);
    };
  }, []);

  const motion =
    phase === "idle" ? "" : `reveal reveal-${animation}${phase === "in" ? " in" : ""}`;

  return (
    <div
      ref={ref}
      className={`${motion} ${className}`.trim()}
      style={delay && phase !== "idle" ? { transitionDelay: `${delay}ms`, animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
