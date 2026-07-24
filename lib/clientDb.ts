"use client";
/* ============ Client content model (localStorage) ============
   A faithful port of the DB singleton from js/db.js, used by the pages that
   remain on the client model in phase 1 (home reviews/gallery, events,
   contacts, and the admin dashboard demo). Auth + real bookings use Supabase.
   Only ever runs in the browser (imported by "use client" components). */

export const DB_KEY = "jpy_db";

const isBrowser = typeof window !== "undefined";

export interface ClientData {
  users: any[];
  bookings: any[];
  courts: any[];
  maintenance: any[];
  notifications: any[];
  reviews: any[];
  events: any[];
  gallery: (string | null)[];
  payment: { gcashNumber: string; bankAccount: string; gcashQr: string | null; bankQr: string | null };
  contact: { address: string; phone: string; email: string; socials: string; note: string };
  settings: {
    openHour: number;
    closeHour: number;
    pricePerHour: number;
    discountAfterHours: number;
    discountPerHour: number;
    paddleRentPerHour: number;
    cancelHours: number;
    currency: string;
  };
  seq: number;
}

export const DB = {
  data: null as ClientData | null,

  defaults(): ClientData {
    return {
      users: [],
      bookings: [],
      courts: [
        { id: "c1", name: "Court 1", active: true, note: "" },
        { id: "c2", name: "Court 2", active: true, note: "" },
        { id: "c3", name: "Court 3", active: true, note: "" },
      ],
      maintenance: [],
      notifications: [],
      reviews: [],
      events: [],
      gallery: [null, null, null, null, null, null, null, null, null, null],
      payment: { gcashNumber: "", bankAccount: "", gcashQr: null, bankQr: null },
      contact: {
        address: "123 Sports Complex Ave., Quezon City, Metro Manila",
        phone: "0917 123 4567",
        email: "hello@jspickleyard.com",
        socials: "Facebook · Instagram · TikTok — @jspickleyard",
        note: "Beside the main gym entrance — free parking for players.",
      },
      settings: {
        openHour: 8,
        closeHour: 22,
        pricePerHour: 200,
        discountAfterHours: 2,
        discountPerHour: 50,
        paddleRentPerHour: 50,
        cancelHours: 2,
        currency: "₱",
      },
      seq: 1000,
    };
  },

  load(): ClientData {
    try {
      const raw = isBrowser ? localStorage.getItem(DB_KEY) : null;
      this.data = raw ? Object.assign(this.defaults(), JSON.parse(raw)) : this.defaults();
    } catch {
      this.data = this.defaults();
    }
    const d = this.data!;
    d.settings = Object.assign(this.defaults().settings, d.settings);
    d.contact = Object.assign(this.defaults().contact, d.contact);
    d.payment = Object.assign(this.defaults().payment, d.payment);
    if (!Array.isArray(d.gallery)) d.gallery = [];
    while (d.gallery.length < 10) d.gallery.push(null);
    return d;
  },

  save() {
    if (isBrowser) localStorage.setItem(DB_KEY, JSON.stringify(this.data));
  },

  nextId(prefix: string): string {
    this.data!.seq += 1;
    return prefix + this.data!.seq;
  },

  findUserByEmail(email: string) {
    email = String(email || "").trim().toLowerCase();
    return this.data!.users.find((u) => u.email === email) || null;
  },
  findUser(id: string) {
    return this.data!.users.find((u) => u.id === id) || null;
  },

  bookingsFor(date: string, courtId: string) {
    return this.data!.bookings.filter(
      (b) => b.date === date && b.courtId === courtId && b.status !== "cancelled",
    );
  },
  isSlotBooked(date: string, courtId: string, hour: number) {
    return this.bookingsFor(date, courtId).find((b) => hour >= b.start && hour < b.end) || null;
  },
  maintenanceAt(date: string, courtId: string, hour: number) {
    return (
      this.data!.maintenance.find(
        (m) =>
          m.date === date &&
          (m.courtId === "all" || m.courtId === courtId) &&
          hour >= m.start &&
          hour < m.end,
      ) || null
    );
  },

  notify(userId: string, msg: string, type = "info") {
    this.data!.notifications.unshift({
      id: this.nextId("n"),
      userId,
      msg,
      type,
      read: false,
      at: Date.now(),
    });
    this.save();
  },
  notifyAdmins(msg: string, type = "info") {
    this.data!.users.filter((u) => u.role === "admin").forEach((a) => this.notify(a.id, msg, type));
  },
};

/* ---- crypto helpers (ported; used only by the client demo seed/admin) ---- */
export async function hashPassword(pass: string, salt: string): Promise<string> {
  const text = `${salt}::${pass}`;
  if (isBrowser && window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "fnv" + (h >>> 0).toString(16);
}

export function randomSalt(): string {
  if (isBrowser && window.crypto && crypto.getRandomValues) {
    return Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return Math.random().toString(36).slice(2, 12);
}

/* Seed a demo admin so the admin dashboard Users tab is populated (phase-1 demo). */
export async function seedClientDb() {
  DB.load();
  if (!DB.data!.users.some((u) => u.role === "admin")) {
    const salt = randomSalt();
    DB.data!.users.push({
      id: "u1",
      name: "Admin",
      email: "admin@jspickleyard.com",
      phone: "",
      salt,
      passHash: await hashPassword("Admin@123", salt),
      role: "admin",
      verified: true,
      active: true,
      createdAt: Date.now(),
    });
    DB.save();
  }
}
