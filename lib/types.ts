/* Shared domain types (ported from the shapes used in js/db.js) */

export type Role = "user" | "admin";

export interface Settings {
  openHour: number;
  closeHour: number;
  pricePerHour: number; // weekday rate (Mon–Fri)
  weekendPricePerHour: number; // weekend rate (Sat–Sun)
  discountAfterHours: number;
  discountPerHour: number;
  paddleRentPerHour: number;
  cancelHours: number;
  currency: string;
}

export interface Court {
  id: string;
  name: string;
  active: boolean;
  note?: string;
  photo?: string | null;
  position?: number;
}

export interface Maintenance {
  id: string;
  courtId: string; // "all" or a court id
  date: string; // YYYY-MM-DD
  start: number;
  end: number;
  reason?: string;
}

export type PayStatus = "unpaid" | "pending" | "paid" | "refunded";
export type BookingStatus = "confirmed" | "cancelled";

export interface Booking {
  id: string;
  ref: string;
  userId: string;
  courtId: string;
  date: string; // YYYY-MM-DD
  start: number;
  end: number;
  paddles: number;
  amount: number;
  payMethod: string;
  payStatus: PayStatus;
  status: BookingStatus;
  proof?: string | null; // storage URL
  proofAt?: number | null;
  createdAt: number;
  cancelledAt?: number | null;
}

export interface Profile {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: number;
}

export interface Review {
  id: string;
  userId: string;
  name: string;
  rating: number;
  text: string;
  status: "published" | "hidden";
  at: number;
}

export interface EventRec {
  id: string;
  title: string;
  date: string;
  time: string;
  desc: string;
  photos: string[];
  createdAt: number;
}

export interface Notification {
  id: string;
  userId: string;
  msg: string;
  type: string;
  read: boolean;
  at: number;
}

export interface SiteConfig {
  gcashNumber: string;
  bankAccount: string;
  gcashQr: string | null;
  bankQr: string | null;
  address: string;
  phone: string;
  email: string;
  socials: string;
  note: string;
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  gcashNumber: "",
  bankAccount: "",
  gcashQr: null,
  bankQr: null,
  address: "123 Sports Complex Ave., Quezon City, Metro Manila",
  phone: "0917 123 4567",
  email: "hello@jspickleyard.com",
  socials: "Facebook · Instagram · TikTok — @jspickleyard",
  note: "Beside the main gym entrance — free parking for players.",
};

/* Matches DB.defaults().settings in js/db.js */
export const DEFAULT_SETTINGS: Settings = {
  openHour: 8,
  closeHour: 22,
  pricePerHour: 200,
  weekendPricePerHour: 250,
  discountAfterHours: 2,
  discountPerHour: 50,
  paddleRentPerHour: 50,
  cancelHours: 2,
  currency: "₱",
};

/* Matches DB.defaults().courts in js/db.js */
export const DEFAULT_COURTS: Court[] = [
  { id: "c1", name: "Court 1", active: true, note: "", position: 1 },
  { id: "c2", name: "Court 2", active: true, note: "", position: 2 },
  { id: "c3", name: "Court 3", active: true, note: "", position: 3 },
];
