"use client";
/* Per-character headline reveal — the "split text" technique from the
   ui-ux-pro-max motion database (Stagger List / Complex: rotateX + y offset,
   expo.out easing, ~15ms per character).

   That preset normally needs GSAP's SplitText, which is a paid Club plugin, so
   this does the same job in plain React + CSS: the text is split into spans and
   each gets an incremental animation-delay.

   Accessibility: the whole phrase is exposed via aria-label and the individual
   character spans are hidden from screen readers, so it still reads as one
   sentence. If CSS never loads, the characters are simply visible. */

interface Segment {
  text: string;
  em?: boolean; // renders in the brand purple, like <em> did
}

const CHAR_STAGGER = 18; // ms between characters
const LINE_GAP = 90; // extra ms before each new line starts

export default function SplitHeadline({
  lines,
  className = "",
}: {
  lines: Segment[][];
  className?: string;
}) {
  const label = lines.map((l) => l.map((s) => s.text).join("")).join(" ");
  let index = 0; // running character count drives the cascade

  return (
    <h1 className={`split-headline ${className}`.trim()} aria-label={label}>
      {lines.map((segments, li) => (
        <span className="split-line" key={li} aria-hidden="true">
          {segments.map((seg, si) => (
            <span className={seg.em ? "split-em" : undefined} key={si}>
              {Array.from(seg.text).map((ch, ci) => {
                const delay = index++ * CHAR_STAGGER + li * LINE_GAP;
                return (
                  <span
                    className="split-char"
                    key={ci}
                    style={{ animationDelay: `${delay}ms` }}
                  >
                    {ch === " " ? " " : ch}
                  </span>
                );
              })}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}
