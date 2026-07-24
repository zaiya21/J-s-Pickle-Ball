import type { Metadata } from "next";
import { getActiveCourts, getSettings, getSiteConfig } from "@/lib/data";
import BookingClient from "@/components/BookingClient";

export const metadata: Metadata = { title: "Book a Court — J's Pickle Yard" };

export default async function BookPage() {
  const [courts, settings, config] = await Promise.all([getActiveCourts(), getSettings(), getSiteConfig()]);
  return (
    <BookingClient
      courts={courts}
      settings={settings}
      pay={{
        gcashNumber: config.gcashNumber,
        bankAccount: config.bankAccount,
        gcashQr: config.gcashQr,
        bankQr: config.bankQr,
      }}
    />
  );
}
