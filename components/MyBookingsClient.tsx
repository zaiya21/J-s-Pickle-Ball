"use client";
/* My Bookings — ported from my-bookings.html + js/mybookings.js. Same markup.
   Bookings are read from Supabase; cancel goes through a server action; proof
   uploads go to Supabase Storage. */
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { DB } from "@/lib/clientDb";
import { cancelBooking } from "@/lib/actions/bookings";
import type { Settings } from "@/lib/types";
import { fmtDateLong, fmtHour, money } from "@/lib/helpers";

export interface MyBooking {
  id: string;
  ref: string;
  courtId: string;
  date: string;
  start: number;
  end: number;
  paddles: number;
  amount: number;
  payMethod: string;
  payStatus: string;
  status: string;
  proof: string | null;
}

export default function MyBookingsClient({
  initial,
  settings,
  courtNames,
  userId,
}: {
  initial: MyBooking[];
  settings: Settings;
  courtNames: Record<string, string>;
  userId: string;
}) {
  const { toast, confirm, showImage } = useToast();
  const supabase = createClient();
  const [bookings, setBookings] = useState<MyBooking[]>(initial);
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");

  const courtName = (id: string) => courtNames[id] || "Court";

  const isUpcoming = (b: MyBooking) => {
    if (b.status !== "confirmed") return false;
    const end = new Date(b.date + "T00:00:00");
    end.setHours(b.end);
    return end > new Date();
  };
  const canCancel = (b: MyBooking) => {
    if (b.status !== "confirmed") return false;
    const start = new Date(b.date + "T00:00:00");
    start.setHours(b.start);
    return start.getTime() - Date.now() > settings.cancelHours * 3600 * 1000;
  };
  const statusOf = (b: MyBooking) => {
    if (b.status === "cancelled") return "cancelled";
    return isUpcoming(b) ? "confirmed" : "completed";
  };

  const key = (b: MyBooking) => b.date + String(b.start).padStart(2, "0");
  let items = bookings
    .slice()
    .sort((a, b) => key(b).localeCompare(key(a)))
    .filter((b) => (tab === "upcoming" ? isUpcoming(b) : !isUpcoming(b)));
  if (tab === "upcoming") items = items.reverse();

  async function onCancel(b: MyBooking) {
    if (!canCancel(b))
      return toast(`Too late to cancel — the ${settings.cancelHours}-hour policy applies.`, "warn");
    const ok = await confirm(
      "Cancel booking?",
      `${courtName(b.courtId)} on ${fmtDateLong(b.date)}, ${fmtHour(b.start)}–${fmtHour(b.end)}. ` +
        (b.payStatus === "paid" ? "Your payment will be refunded (simulated)." : ""),
      "Cancel booking",
    );
    if (!ok) return;
    const res = await cancelBooking(b.id);
    if (!res.ok) return toast(res.error || "Could not cancel.", "error");
    setBookings((prev) =>
      prev.map((x) =>
        x.id === b.id
          ? { ...x, status: "cancelled", payStatus: x.payStatus === "paid" ? "refunded" : x.payStatus }
          : x,
      ),
    );
    DB.load();
    DB.notify(userId, `Booking ${b.ref} on ${fmtDateLong(b.date)} was cancelled.`, "warn");
    toast("Booking cancelled.", "success");
  }

  async function onProof(b: MyBooking, file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const path = `${userId}/${b.id}.jpg`;
    const { error: upErr } = await supabase.storage.from("proofs").upload(path, file, { upsert: true });
    if (upErr) return toast("Couldn't upload that image. Try a smaller file.", "error");
    const { data: pub } = supabase.storage.from("proofs").getPublicUrl(path);
    const url = `${pub.publicUrl}?t=${Date.now()}`;
    const { error: dbErr } = await supabase
      .from("bookings")
      .update({ proof_url: url, proof_at: new Date().toISOString() })
      .eq("id", b.id);
    if (dbErr) return toast("Couldn't save the proof. Please try again.", "error");
    setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, proof: url } : x)));
    toast("Proof of payment submitted — we'll verify it shortly!", "success");
  }

  return (
    <main className="page-wrap">
      <div className="page-head">
        <h1>My Bookings</h1>
        <p className="muted">
          Cancellations are allowed up to <strong>{settings.cancelHours} hours</strong> before your start time.
        </p>
      </div>

      <div className="tab-row">
        <button className={`tab ${tab === "upcoming" ? "active" : ""}`} onClick={() => setTab("upcoming")}>
          Upcoming
        </button>
        <button className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
          Booking History
        </button>
      </div>

      <div className="booking-list">
        {items.length === 0 ? (
          <div className="empty-state">
            {tab === "upcoming" ? (
              <>
                No upcoming bookings.
                <br />
                <Link className="link" href="/book">
                  Book a court now →
                </Link>
              </>
            ) : (
              "No booking history yet."
            )}
          </div>
        ) : (
          items.map((b) => {
            const st = statusOf(b);
            return (
              <div className="booking-card" key={b.id}>
                <div>
                  <div className="b-date">
                    {fmtDateLong(b.date)} · {fmtHour(b.start)} – {fmtHour(b.end)}
                  </div>
                  <div className="b-meta">
                    {courtName(b.courtId)} · Ref {b.ref}
                    {b.paddles ? ` · 🏓 ${b.paddles} paddle${b.paddles > 1 ? "s" : ""}` : ""} · {b.payMethod} (
                    {b.payStatus})
                  </div>
                </div>
                <div className="row gap">
                  <span className={`badge ${st}`}>{st}</span>
                  {b.payStatus === "pending" && <span className="badge pending">awaiting verification</span>}
                  <strong className="price">{money(settings, b.amount)}</strong>
                  {b.proof && (
                    <button className="mini-btn" onClick={() => showImage(b.proof!, "Proof of payment " + b.ref)}>
                      View proof
                    </button>
                  )}
                  {b.status === "confirmed" && (b.payStatus === "pending" || b.payStatus === "unpaid") && (
                    <label className="mini-btn" style={{ cursor: "pointer" }}>
                      {b.proof ? "Re-upload proof" : "Upload proof of payment"}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => onProof(b, e.target.files?.[0])}
                      />
                    </label>
                  )}
                  {canCancel(b) && tab === "upcoming" && (
                    <button className="mini-btn danger" onClick={() => onCancel(b)}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
