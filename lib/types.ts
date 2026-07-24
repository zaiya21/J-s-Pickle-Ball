/* Shared domain types (ported from the shapes used in js/db.js) */

export type Role = "user" | "admin";

export interface Settings {
  openHour: number;
  closeHour: number;
  pricePerHour: number;
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

/* Matches DB.defaults().settings in js/db.js */
export const DEFAULT_SETTINGS: Settings = {
  openHour: 8,
  closeHour: 22,
  pricePerHour: 200,
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
