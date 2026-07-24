"use server";
/* Server actions for the real booking flow. All validation and pricing happen
   here — never trusting client-sent amounts — mirroring the checks in
   js/booking.js confirmBooking() and js/mybookings.js cancel(). */
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { calcTotal, bookingRef } from "@/lib/helpers";

export interface CreateBookingInput {
  courtId: string;
  date: string; // YYYY-MM-DD
  start: number;
  end: number;
  paddles: number;
  payMethod: string;
}

export interface BookingActionResult {
  ok: boolean;
  error?: string;
  receipt?: {
    ref: string;
    courtId: string;
    date: string;
    start: number;
    end: number;
    paddles: number;
    amount: number;
    payMethod: string;
    payStatus: string;
  };
}

export async function createBooking(input: CreateBookingInput): Promise<BookingActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in first." };

  const { courtId, date, start, end, payMethod } = input;
  const paddles = Math.max(0, Math.min(8, Math.floor(input.paddles || 0)));
  const hours = end - start;

  // basic shape validation
  if (!courtId || !date || !Number.isInteger(start) || !Number.isInteger(end) || hours <= 0)
    return { ok: false, error: "Invalid booking details." };

  const settings = await getSettings();
  if (start < settings.openHour || end > settings.closeHour)
    return { ok: false, error: "Selected time is outside opening hours." };

  // reject past times
  const startAt = new Date(date + "T00:00:00");
  startAt.setHours(start);
  if (startAt.getTime() <= Date.now())
    return { ok: false, error: "That time has already passed — pick a later slot." };

  // maintenance overlap
  const { data: maint } = await supabase
    .from("maintenance")
    .select("court_id,start_hour,end_hour")
    .eq("date", date);
  const blocked = (maint ?? []).some(
    (m) => (m.court_id === "all" || m.court_id === courtId) && m.start_hour < end && m.end_hour > start,
  );
  if (blocked) return { ok: false, error: "That slot is under maintenance." };

  const amount = calcTotal(settings, hours, paddles);
  const payStatus = payMethod === "Pay at venue" ? "unpaid" : "pending";
  const ref = bookingRef();

  const { error } = await supabase.from("bookings").insert({
    ref,
    user_id: user.id,
    court_id: courtId,
    date,
    start_hour: start,
    end_hour: end,
    paddles,
    amount,
    pay_method: payMethod,
    pay_status: payStatus,
    status: "confirmed",
  });

  if (error) {
    // 23P01 = exclusion constraint (overlapping confirmed booking)
    if (error.code === "23P01" || /overlap|exclusion/i.test(error.message))
      return { ok: false, error: "Sorry — one of those slots was just taken. Please pick again." };
    return { ok: false, error: "Could not save the booking. Please try again." };
  }

  return {
    ok: true,
    receipt: { ref, courtId, date, start, end, paddles, amount, payMethod, payStatus },
  };
}

export async function cancelBooking(id: string): Promise<BookingActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in first." };

  const { data: b } = await supabase.from("bookings").select("*").eq("id", id).single();
  if (!b || b.user_id !== user.id) return { ok: false, error: "Booking not found." };
  if (b.status !== "confirmed") return { ok: false, error: "Booking is not active." };

  const settings = await getSettings();
  const start = new Date(b.date + "T00:00:00");
  start.setHours(b.start_hour);
  if (start.getTime() - Date.now() <= settings.cancelHours * 3600 * 1000)
    return { ok: false, error: `Too late to cancel — the ${settings.cancelHours}-hour policy applies.` };

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      pay_status: b.pay_status === "paid" ? "refunded" : b.pay_status,
    })
    .eq("id", id);

  if (error) return { ok: false, error: "Could not cancel. Please try again." };
  return { ok: true };
}
