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

/* ---- venue time (Asia/Manila, UTC+8, no DST) ----
   Computed identically on the server and the client so the booking grid never
   disagrees between SSR and hydration, and never mis-marks slots by timezone. */
export const MANILA_TZ = "Asia/Manila";

export function manilaNow(): { dateStr: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some engines report midnight as "24"
  return { dateStr: `${get("year")}-${get("month")}-${get("day")}`, hour };
}

export function manilaTodayStr(): string {
  return manilaNow().dateStr;
}

/* The absolute instant a Manila slot starts (fixed +08:00 offset, no DST). */
export function manilaSlotStart(dateStr: string, hour: number): Date {
  return new Date(`${dateStr}T${String(hour).padStart(2, "0")}:00:00+08:00`);
}

/* Add n days to a YYYY-MM-DD string, anchored at noon UTC to dodge edges. */
export function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* Deterministic weekday/day/month labels for a date chip. */
export function dateChipParts(dateStr: string): { dow: string; dom: string; mon: string } {
  const d = new Date(dateStr + "T12:00:00Z");
  return {
    dow: d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" }),
    dom: String(d.getUTCDate()),
    mon: d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short" }),
  };
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

/* Weekend = Saturday or Sunday, from a YYYY-MM-DD string (UTC-anchored so the
   result is the same on server and client). */
export function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00Z").getUTCDay();
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

/* Downscale + compress an image file to a JPEG Blob for upload (client-only).
   Keeps big phone photos from being served at full size. */
export function compressImage(file: File, maxW = 1400, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("not an image"));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("compress failed"))),
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}
