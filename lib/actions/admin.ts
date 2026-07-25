"use server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, type ActionResult } from "./guard";
import { fmtDateLong, fmtHour } from "@/lib/helpers";

/* ---------------- bookings ---------------- */
export async function markBookingPaid(id: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = createClient();
  const { data: b } = await supabase.from("bookings").select("ref,user_id").eq("id", id).single();
  if (!b) return { ok: false, error: "Booking not found." };
  const { error } = await supabase.from("bookings").update({ pay_status: "paid" }).eq("id", id);
  if (error) return { ok: false, error: "Update failed." };
  await supabase.rpc("add_notification", {
    p_user: b.user_id,
    p_msg: `Payment received for booking ${b.ref}. See you on the court!`,
    p_type: "success",
  });
  return { ok: true };
}

export async function adminCancelBooking(id: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = createClient();
  const { data: b } = await supabase.from("bookings").select("*").eq("id", id).single();
  if (!b || b.status !== "confirmed") return { ok: false, error: "Booking is not active." };
  const { error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      pay_status: b.pay_status === "paid" ? "refunded" : b.pay_status,
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Cancel failed." };
  await supabase.rpc("add_notification", {
    p_user: b.user_id,
    p_msg: `Your booking ${b.ref} on ${fmtDateLong(b.date)} was cancelled by the admin.${
      b.pay_status === "paid" ? " A refund was issued." : ""
    }`,
    p_type: "warn",
  });
  return { ok: true };
}

/* ---------------- users ---------------- */
export async function setUserRole(id: string, role: "user" | "admin"): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  return error ? { ok: false, error: "Update failed." } : { ok: true };
}

export async function setUserActive(id: string, active: boolean): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ active }).eq("id", id);
  return error ? { ok: false, error: "Update failed." } : { ok: true };
}

/* ---------------- courts ---------------- */
export async function addCourt(name: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const clean = name.trim().slice(0, 30);
  if (!clean) return { ok: false, error: "Enter a court name." };
  const supabase = createClient();
  const { data: last } = await supabase.from("courts").select("position").order("position", { ascending: false }).limit(1);
  const position = (last?.[0]?.position ?? 0) + 1;
  const { error } = await supabase
    .from("courts")
    .insert({ id: "c" + Date.now().toString(36), name: clean, active: true, note: "", position });
  return error ? { ok: false, error: "Could not add court." } : { ok: true };
}

export async function renameCourt(id: string, name: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const clean = name.trim().slice(0, 30);
  if (!clean) return { ok: false, error: "Enter a name." };
  const supabase = createClient();
  const { error } = await supabase.from("courts").update({ name: clean }).eq("id", id);
  return error ? { ok: false, error: "Rename failed." } : { ok: true };
}

export async function toggleCourt(id: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = createClient();
  const { data: c } = await supabase.from("courts").select("active").eq("id", id).single();
  if (!c) return { ok: false, error: "Court not found." };
  const { error } = await supabase.from("courts").update({ active: !c.active }).eq("id", id);
  return error ? { ok: false, error: "Update failed." } : { ok: true };
}

export async function setCourtPhoto(id: string, url: string | null): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = createClient();
  const { error } = await supabase.from("courts").update({ photo: url }).eq("id", id);
  return error ? { ok: false, error: "Update failed." } : { ok: true };
}

/* ---------------- maintenance ---------------- */
export async function addMaintenance(input: {
  courtId: string;
  date: string;
  start: number;
  end: number;
  reason: string;
}): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  if (input.end <= input.start) return { ok: false, error: "End time must be after start time." };
  if (!input.date) return { ok: false, error: "Pick a date." };
  const supabase = createClient();
  const { error } = await supabase.from("maintenance").insert({
    court_id: input.courtId,
    date: input.date,
    start_hour: input.start,
    end_hour: input.end,
    reason: input.reason.trim(),
  });
  return error ? { ok: false, error: "Could not schedule maintenance." } : { ok: true };
}

export async function deleteMaintenance(id: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = createClient();
  const { error } = await supabase.from("maintenance").delete().eq("id", id);
  return error ? { ok: false, error: "Delete failed." } : { ok: true };
}

/* ---------------- settings ---------------- */
export async function saveHours(open: number, close: number): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  if (close <= open) return { ok: false, error: "Closing time must be after opening time." };
  const supabase = createClient();
  const { error } = await supabase.from("settings").update({ open_hour: open, close_hour: close }).eq("id", 1);
  return error ? { ok: false, error: "Save failed." } : { ok: true };
}

export async function savePricing(
  price: number,
  weekendPrice: number,
  after: number,
  disc: number,
  paddle: number,
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  if (disc > price || disc > weekendPrice)
    return { ok: false, error: "Discount cannot exceed the hourly rate." };
  const supabase = createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      price_per_hour: price,
      weekend_price_per_hour: weekendPrice,
      discount_after_hours: Math.max(1, after),
      discount_per_hour: disc,
      paddle_rent_per_hour: paddle,
    })
    .eq("id", 1);
  return error ? { ok: false, error: "Save failed." } : { ok: true };
}

export async function savePolicy(cancelHours: number): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = createClient();
  const { error } = await supabase.from("settings").update({ cancel_hours: Math.max(0, cancelHours) }).eq("id", 1);
  return error ? { ok: false, error: "Save failed." } : { ok: true };
}

/* ---------------- site config (payment + contact) ---------------- */
export async function savePaymentNumbers(gcash: string, bank: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = createClient();
  const { error } = await supabase
    .from("site_config")
    .update({ gcash_number: gcash.trim(), bank_account: bank.trim() })
    .eq("id", 1);
  return error ? { ok: false, error: "Save failed." } : { ok: true };
}

export async function setPaymentQr(which: "gcash" | "bank", url: string | null): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = createClient();
  const col = which === "gcash" ? "gcash_qr" : "bank_qr";
  const { error } = await supabase.from("site_config").update({ [col]: url }).eq("id", 1);
  return error ? { ok: false, error: "Save failed." } : { ok: true };
}

export async function saveContact(input: {
  address: string;
  phone: string;
  email: string;
  socials: string;
  note: string;
}): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = createClient();
  const { error } = await supabase
    .from("site_config")
    .update({
      address: input.address.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      socials: input.socials.trim(),
      note: input.note.trim(),
    })
    .eq("id", 1);
  return error ? { ok: false, error: "Save failed." } : { ok: true };
}

/* ---------------- gallery ---------------- */
export async function setGallerySlot(slot: number, url: string | null): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = createClient();
  if (url === null) {
    const { error } = await supabase.from("gallery").delete().eq("slot", slot);
    return error ? { ok: false, error: "Update failed." } : { ok: true };
  }
  const { error } = await supabase.from("gallery").upsert({ slot, url }, { onConflict: "slot" });
  return error ? { ok: false, error: "Update failed." } : { ok: true };
}
