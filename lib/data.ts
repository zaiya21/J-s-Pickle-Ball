import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_SETTINGS,
  DEFAULT_COURTS,
  DEFAULT_SITE_CONFIG,
  type Settings,
  type Court,
  type Review,
  type EventRec,
  type Notification,
  type SiteConfig,
} from "@/lib/types";

/* Server-side reads of the booking-domain tables (Supabase). Fall back to the
   seeded defaults if the row is missing, so pages never crash pre-seed. */

export async function getSettings(): Promise<Settings> {
  const supabase = createClient();
  const { data } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (!data) return { ...DEFAULT_SETTINGS };
  return {
    openHour: data.open_hour,
    closeHour: data.close_hour,
    pricePerHour: data.price_per_hour,
    // Falls back to the weekday rate if the weekend column isn't added yet.
    weekendPricePerHour: data.weekend_price_per_hour ?? data.price_per_hour,
    discountAfterHours: data.discount_after_hours,
    discountPerHour: data.discount_per_hour,
    paddleRentPerHour: data.paddle_rent_per_hour,
    cancelHours: data.cancel_hours,
    currency: data.currency,
  };
}

export async function getActiveCourts(): Promise<Court[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("courts")
    .select("*")
    .eq("active", true)
    .order("position", { ascending: true });
  if (!data || data.length === 0) return DEFAULT_COURTS.filter((c) => c.active);
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    active: c.active,
    note: c.note ?? "",
    position: c.position,
    photo: c.photo ?? null,
  }));
}

export async function getAllCourts(): Promise<Court[]> {
  const supabase = createClient();
  const { data } = await supabase.from("courts").select("*").order("position", { ascending: true });
  if (!data || data.length === 0) return DEFAULT_COURTS;
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    active: c.active,
    note: c.note ?? "",
    position: c.position,
    photo: c.photo ?? null,
  }));
}

/* ---- reviews ---- */
export async function getPublishedReviews(): Promise<Review[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapReview);
}

export async function getMyReview(userId: string): Promise<Review | null> {
  if (!userId) return null;
  const supabase = createClient();
  const { data } = await supabase.from("reviews").select("*").eq("user_id", userId).maybeSingle();
  return data ? mapReview(data) : null;
}

function mapReview(r: any): Review {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    rating: r.rating,
    text: r.text,
    status: r.status,
    at: new Date(r.created_at).getTime(),
  };
}

/* ---- events ---- */
export async function getEvents(): Promise<EventRec[]> {
  const supabase = createClient();
  const { data } = await supabase.from("events").select("*").order("date", { ascending: true });
  return (data ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    time: e.time ?? "",
    desc: e.description,
    photos: e.photos ?? [],
    createdAt: new Date(e.created_at).getTime(),
  }));
}

/* ---- notifications ---- */
export async function getNotifications(userId: string): Promise<Notification[]> {
  if (!userId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []).map((n) => ({
    id: n.id,
    userId: n.user_id,
    msg: n.message,
    type: n.type,
    read: n.read,
    at: new Date(n.created_at).getTime(),
  }));
}

/* ---- site config (payment + contact) ---- */
export async function getSiteConfig(): Promise<SiteConfig> {
  const supabase = createClient();
  const { data } = await supabase.from("site_config").select("*").eq("id", 1).maybeSingle();
  if (!data) return { ...DEFAULT_SITE_CONFIG };
  return {
    gcashNumber: data.gcash_number ?? "",
    bankAccount: data.bank_account ?? "",
    gcashQr: data.gcash_qr ?? null,
    bankQr: data.bank_qr ?? null,
    address: data.address ?? "",
    phone: data.phone ?? "",
    email: data.email ?? "",
    socials: data.socials ?? "",
    note: data.note ?? "",
  };
}

/* ---- homepage gallery: 10 slots, null = use default p{n}.jpg ---- */
export async function getGallery(): Promise<(string | null)[]> {
  const supabase = createClient();
  const { data } = await supabase.from("gallery").select("*");
  const out: (string | null)[] = new Array(10).fill(null);
  (data ?? []).forEach((g: any) => {
    if (g.slot >= 0 && g.slot < 10) out[g.slot] = g.url;
  });
  return out;
}

/* ---- aggregate admin snapshot ---- */
export interface AdminData {
  bookings: any[];
  users: any[];
  courts: Court[];
  maintenance: any[];
  settings: Settings;
  reviews: Review[];
  config: SiteConfig;
  gallery: (string | null)[];
}

export async function getAdminData(): Promise<AdminData> {
  const supabase = createClient();
  const [{ data: bookings }, { data: users }, courts, { data: maint }, settings, { data: reviews }, config, gallery] =
    await Promise.all([
      supabase.from("bookings").select("*"),
      supabase.from("profiles").select("*"),
      getAllCourts(),
      supabase.from("maintenance").select("*"),
      getSettings(),
      supabase.from("reviews").select("*"),
      getSiteConfig(),
      getGallery(),
    ]);

  return {
    bookings: (bookings ?? []).map((b) => ({
      id: b.id,
      ref: b.ref,
      userId: b.user_id,
      courtId: b.court_id,
      date: b.date,
      start: b.start_hour,
      end: b.end_hour,
      paddles: b.paddles,
      amount: b.amount,
      payMethod: b.pay_method,
      payStatus: b.pay_status,
      status: b.status,
      proof: b.proof_url ?? null,
    })),
    users: (users ?? []).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      active: u.active,
      createdAt: new Date(u.created_at).getTime(),
    })),
    courts,
    maintenance: (maint ?? []).map((m) => ({
      id: m.id,
      courtId: m.court_id,
      date: m.date,
      start: m.start_hour,
      end: m.end_hour,
      reason: m.reason ?? "",
    })),
    settings,
    reviews: (reviews ?? []).map(mapReview),
    config,
    gallery,
  };
}
