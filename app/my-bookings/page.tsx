import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSettings, getAllCourts } from "@/lib/data";
import MyBookingsClient, { type MyBooking } from "@/components/MyBookingsClient";

export const metadata: Metadata = { title: "My Bookings — J's Pickle Yard" };

export default async function MyBookingsPage() {
  const supabase = createClient();
  const [settings, courts] = await Promise.all([getSettings(), getAllCourts()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from("bookings")
    .select("*")
    .eq("user_id", user?.id ?? "")
    .order("date", { ascending: false });

  const bookings: MyBooking[] = (rows ?? []).map((b) => ({
    id: b.id,
    ref: b.ref,
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
  }));

  const courtNames: Record<string, string> = {};
  courts.forEach((c) => (courtNames[c.id] = c.name));

  return (
    <MyBookingsClient
      initial={bookings}
      settings={settings}
      courtNames={courtNames}
      userId={user?.id ?? ""}
    />
  );
}
