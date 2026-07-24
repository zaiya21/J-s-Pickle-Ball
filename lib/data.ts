import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, DEFAULT_COURTS, type Settings, type Court } from "@/lib/types";

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
  }));
}
