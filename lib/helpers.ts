/* Pure helpers ported from js/db.js.
   Functions that used the global DB.data.settings now take a Settings arg. */
import type { Settings } from "./types";

/* ---- date/format ---- */
export function todayStr(): string {
  return dateToStr(new Date());
}

export function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fmtHour(h: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}:00 ${ampm}`;
}

export function fmtDateLong(str: string): string {
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

/* ---- money / pricing ---- */
export function money(settings: Settings, n: number): string {
  return settings.currency + Number(n).toLocaleString();
}
// alias matching js/db.js name
export const fmtMoney = money;

/* Weekend = Saturday or Sunday, from a YYYY-MM-DD string. */
export function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + "T00:00:00").getDay();
  return d === 0 || d === 6;
}

/* The applicable per-hour base rate for the day (weekday vs weekend). */
export function baseRate(settings: Settings, weekend: boolean): number {
  return weekend ? settings.weekendPricePerHour : settings.pricePerHour;
}

export function calcCourtCost(settings: Settings, hours: number, weekend = false): number {
  const rate = baseRate(settings, weekend);
  const full = Math.min(hours, settings.discountAfterHours);
  const extra = Math.max(0, hours - settings.discountAfterHours);
  return full * rate + extra * (rate - settings.discountPerHour);
}

export function calcPaddleCost(settings: Settings, paddles: number, hours: number): number {
  return paddles * settings.paddleRentPerHour * hours;
}

export function calcTotal(settings: Settings, hours: number, paddles: number, weekend = false): number {
  return calcCourtCost(settings, hours, weekend) + calcPaddleCost(settings, paddles || 0, hours);
}

/* ---- misc ---- */
export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function bookingRef(): string {
  return "JPY-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/* Booking reference / password rule shared with the auth UI */
export function validPassword(p: string): boolean {
  return typeof p === "string" && p.length >= 8 && /[a-zA-Z]/.test(p) && /\d/.test(p);
}

/* Escapes text for insertion into raw HTML strings (used by the admin PDF export
   which builds a printable document string). JSX escapes automatically, so this
   is only needed where we assemble HTML by hand. */
export function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }) as Record<string, string>)[c],
  );
}

export const GALLERY_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='260'>` +
      `<rect width='100%' height='100%' fill='#1e1830'/>` +
      `<text x='50%' y='50%' fill='#7d7495' font-family='sans-serif' font-size='16' text-anchor='middle'>Photo coming soon</text></svg>`,
  );

/* Downscale + compress an image file to a data URL (client-only).
   Ported from imageFileToDataURL in js/db.js. */
export function imageFileToDataURL(file: File, maxW = 1000, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}
