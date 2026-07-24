import type { Metadata } from "next";
import { getEvents } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import EventsClient from "@/components/EventsClient";

export const metadata: Metadata = { title: "Tournaments & Events — J's Pickle Yard" };

export default async function EventsPage() {
  const [events, user] = await Promise.all([getEvents(), getCurrentUser()]);
  return <EventsClient events={events} isAdmin={user?.profile.role === "admin"} />;
}
