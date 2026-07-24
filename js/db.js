/* ============ Data layer (localStorage) ============ */
const DB_KEY = "jpy_db";
const SESSION_KEY = "jpy_session";

const DB = {
  data: null,

  defaults() {
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
      reviews: [],   // {id, userId, name, rating 1-5, text, at, status: published|hidden}
      events: [],    // {id, title, date, time, desc, photos:[dataURL, max 5], createdAt}
      gallery: [null, null, null, null, null, null, null, null, null, null],  // homepage overrides; null = use p1.jpg…p10.jpg
      payment: {
        gcashNumber: "",   // e.g. 0917 123 4567 — shown when paying via GCash
        bankAccount: "",   // e.g. BDO 1234-5678-90 — shown when paying via bank
        gcashQr: null,     // admin-uploaded QR images (dataURL)
        bankQr: null,
      },
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
        pricePerHour: 200,        // ₱ per hour, per court
        discountAfterHours: 2,    // hours beyond this get a discount
        discountPerHour: 50,      // ₱ off per extra hour (→ ₱150/hr after 2 hrs)
        paddleRentPerHour: 50,    // ₱ per paddle per hour
        cancelHours: 2,
        currency: "₱",
      },
      seq: 1000,
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      this.data = raw ? Object.assign(this.defaults(), JSON.parse(raw)) : this.defaults();
    } catch {
      this.data = this.defaults();
    }
    // Merge settings/contact so new keys appear after upgrades
    this.data.settings = Object.assign(this.defaults().settings, this.data.settings);
    this.data.contact = Object.assign(this.defaults().contact, this.data.contact);
    this.data.payment = Object.assign(this.defaults().payment, this.data.payment);
    // pad gallery to 10 slots (older saves had 5)
    if (!Array.isArray(this.data.gallery)) this.data.gallery = [];
    while (this.data.gallery.length < 10) this.data.gallery.push(null);
    return this.data;
  },

  save() {
    localStorage.setItem(DB_KEY, JSON.stringify(this.data));
  },

  nextId(prefix) {
    this.data.seq += 1;
    return prefix + this.data.seq;
  },

  /* ---- users ---- */
  findUserByEmail(email) {
    email = String(email || "").trim().toLowerCase();
    return this.data.users.find((u) => u.email === email) || null;
  },
  findUser(id) {
    return this.data.users.find((u) => u.id === id) || null;
  },

  /* ---- bookings ---- */
  bookingsFor(date, courtId) {
    return this.data.bookings.filter(
      (b) => b.date === date && b.courtId === courtId && b.status !== "cancelled"
    );
  },
  isSlotBooked(date, courtId, hour) {
    return this.bookingsFor(date, courtId).find((b) => hour >= b.start && hour < b.end) || null;
  },
  maintenanceAt(date, courtId, hour) {
    return (
      this.data.maintenance.find(
        (m) =>
          m.date === date &&
          (m.courtId === "all" || m.courtId === courtId) &&
          hour >= m.start &&
          hour < m.end
      ) || null
    );
  },

  /* ---- notifications ---- */
  notify(userId, msg, type = "info") {
    this.data.notifications.unshift({
      id: this.nextId("n"),
      userId,
      msg,
      type,
      read: false,
      at: Date.now(),
    });
    this.save();
  },
  notifyAdmins(msg, type = "info") {
    this.data.users
      .filter((u) => u.role === "admin")
      .forEach((a) => this.notify(a.id, msg, type));
  },

  /* ---- session ---- */
  setSession(userId, remember) {
    const token = { userId, at: Date.now() };
    if (remember) localStorage.setItem(SESSION_KEY, JSON.stringify(token));
    else sessionStorage.setItem(SESSION_KEY, JSON.stringify(token));
  },
  getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  },
};

/* ---- crypto helpers ---- */
async function hashPassword(pass, salt) {
  const text = `${salt}::${pass}`;
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback (non-secure-context) — simple FNV-1a, demo only
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "fnv" + (h >>> 0).toString(16);
}

function randomSalt() {
  if (window.crypto && crypto.getRandomValues) {
    return Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return Math.random().toString(36).slice(2, 12);
}

function randomCode() {
  if (window.crypto && crypto.getRandomValues) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
    return String(n).padStart(6, "0");
  }
  return String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
}

/* ---- date/format helpers ---- */
function todayStr() {
  return dateToStr(new Date());
}
function dateToStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtHour(h) {
  const ampm = h >= 12 ? "PM" : "AM";
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}:00 ${ampm}`;
}
function fmtDateLong(str) {
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function fmtMoney(n) {
  return DB.data.settings.currency + Number(n).toLocaleString();
}

/* ---- pricing ----
   First N hours at full rate, every hour after that gets a per-hour discount.
   e.g. 3 hrs = 2×₱200 + 1×₱150 = ₱550. Paddles rent per paddle per hour. */
function calcCourtCost(hours) {
  const s = DB.data.settings;
  const full = Math.min(hours, s.discountAfterHours);
  const extra = Math.max(0, hours - s.discountAfterHours);
  return full * s.pricePerHour + extra * (s.pricePerHour - s.discountPerHour);
}
function calcPaddleCost(paddles, hours) {
  return paddles * DB.data.settings.paddleRentPerHour * hours;
}
function calcTotal(hours, paddles) {
  return calcCourtCost(hours) + calcPaddleCost(paddles || 0, hours);
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/* ---- homepage gallery helpers ---- */
const GALLERY_PLACEHOLDER =
  "data:image/svg+xml," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='260'>` +
    `<rect width='100%' height='100%' fill='#1e1830'/>` +
    `<text x='50%' y='50%' fill='#7d7495' font-family='sans-serif' font-size='16' text-anchor='middle'>Photo coming soon</text></svg>`);

/* Slot i (0-4): admin-uploaded override wins, else the p1…p5 file, else placeholder */
function setGalleryImg(img, i) {
  const ov = (DB.data.gallery || [])[i];
  if (ov) { img.onerror = null; img.src = ov; return; }
  const cands = [`p${i + 1}.jpg`, `p${i + 1}.png`, `p${i + 1}.jpeg`, `p${i + 1}.webp`];
  let k = 0;
  img.onerror = () => {
    k++;
    if (k < cands.length) img.src = cands[k];
    else { img.onerror = null; img.src = GALLERY_PLACEHOLDER; }
  };
  img.src = cands[0];
}

/* Court photo: admin-uploaded override on the court record wins,
   else p1/p2/p3… by court position, else placeholder */
function setCourtImg(img, courtId) {
  const idx = DB.data.courts.findIndex((c) => c.id === courtId);
  const c = DB.data.courts[idx];
  if (c && c.photo) { img.onerror = null; img.src = c.photo; return; }
  const n = idx + 1;
  const cands = [`p${n}.jpg`, `p${n}.png`, `p${n}.jpeg`, `p${n}.webp`];
  let k = 0;
  img.onerror = () => {
    k++;
    if (k < cands.length) img.src = cands[k];
    else { img.onerror = null; img.src = GALLERY_PLACEHOLDER; }
  };
  img.src = cands[0];
}

/* Downscale + compress an image file (shared by events + gallery admin) */
function imageFileToDataURL(file, maxW = 1000, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

/* ---- seed ---- */
async function seedDB() {
  DB.load();
  if (!DB.data.users.some((u) => u.role === "admin")) {
    const salt = randomSalt();
    DB.data.users.push({
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
