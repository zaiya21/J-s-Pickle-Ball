"use client";
/* Scroll-reveal wrapper.

   REPLAYS BOTH WAYS: the observer keeps watching after the first reveal, so a
   section animates in every time it enters the viewport — scrolling down or
   back up. Equivalent to GSAP ScrollTrigger's
   toggleActions: "play none none reverse".

   FAIL-SAFE BY DESIGN: the server-rendered markup carries no hiding class, so
   if JavaScript never runs the content is simply visible. Hiding only ever
   happens to elements that are off-screen, so nothing visibly disappears.

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

    // Start already-visible blocks in the shown state (no flash on load);
    // everything below the fold starts hidden and waits its turn.
    const onScreen = el.getBoundingClientRect().top < window.innerHeight * 0.9;
    setPhase(onScreen ? "in" : "armed");

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Entering -> play. Leaving -> reset so it can play again next time.
          setPhase(entry.isIntersecting ? "in" : "armed");
        });
      },
      // matches GSAP ScrollTrigger start: "top 85%"
      { threshold: 0, rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);

    return () => io.disconnect();
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
