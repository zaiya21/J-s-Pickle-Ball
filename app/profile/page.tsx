import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { money } from "@/lib/helpers";
import ProfileClient from "@/components/ProfileClient";

export const metadata: Metadata = { title: "My Profile — J's Pickle Yard" };

export default async function ProfilePage() {
  const supabase = createClient();
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const { data: rows } = await supabase.from("bookings").select("*").eq("user_id", user?.id ?? "");

  const mine = rows ?? [];
  const played = mine.filter((b) => b.status !== "cancelled");
  const hours = played.reduce((t, b) => t + (b.end_hour - b.start_hour), 0);
  const spent = played.filter((b) => b.pay_status === "paid").reduce((t, b) => t + b.amount, 0);
  const memberSince = user
    ? new Date(user.profile.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : "";

  return (
    <main className="page-wrap">
      <div className="page-head">
        <h1>My Profile</h1>
      </div>

      <ProfileClient
        name={user?.profile.name ?? ""}
        phone={user?.profile.phone ?? ""}
        email={user?.email ?? ""}
      />

      <div className="card stat-strip">
        <div className="stat">
          <div className="stat-num">{played.length}</div>
          <div className="stat-label">Bookings</div>
        </div>
        <div className="stat">
          <div className="stat-num">{hours}</div>
          <div className="stat-label">Hours played</div>
        </div>
        <div className="stat">
          <div className="stat-num">{money(settings, spent)}</div>
          <div className="stat-label">Total paid</div>
        </div>
        <div className="stat">
          <div className="stat-num">{memberSince}</div>
          <div className="stat-label">Member since</div>
        </div>
      </div>
    </main>
  );
}
