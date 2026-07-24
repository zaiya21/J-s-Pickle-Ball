import type { Metadata } from "next";
import { getActiveCourts, getSettings } from "@/lib/data";
import BookingClient from "@/components/BookingClient";

export const metadata: Metadata = { title: "Book a Court — J's Pickle Yard" };

export default async function BookPage() {
  const [courts, settings] = await Promise.all([getActiveCourts(), getSettings()]);
  return <BookingClient courts={courts} settings={settings} />;
}
