"use client";
/* Booking UI — ported from book.html + js/booking.js. Same markup/classes.
   Availability + pricing are enforced server-side; occupancy is read live from
   Supabase so slots reflect other users' bookings. */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/session";
import { useToast } from "@/components/toast";
import { DB } from "@/lib/clientDb";
import { createBooking } from "@/lib/actions/bookings";
import type { Court, Settings } from "@/lib/types";
import {
  GALLERY_PLACEHOLDER,
  calcCourtCost,
  calcTotal,
  dateToStr,
  fmtDateLong,
  fmtHour,
  money,
  todayStr,
} from "@/lib/helpers";

interface Occ {
  start: number;
  end: number;
  userId: string;
}
interface Maint {
  courtId: string;
  start: number;
  end: number;
}
interface Receipt {
  ref: string;
  courtName: string;
  date: string;
  start: number;
  end: number;
  paddles: number;
  amount: number;
  payMethod: string;
  payStatus: string;
}

const EXTS = ["jpg", "png", "jpeg", "webp"];

function CourtPhoto({ n, name }: { n: number; name: string }) {
  const [idx, setIdx] = useState(0);
  const src = idx < EXTS.length ? `/p${n}.${EXTS[idx]}` : GALLERY_PLACEHOLDER;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      id="courtPhoto"
      src={src}
      alt={`Photo of ${name}`}
      onError={() => setIdx((i) => (i < EXTS.length ? i + 1 : i))}
    />
  );
}

export default function BookingClient({ courts, settings }: { courts: Court[]; settings: Settings }) {
  const user = useSession();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [courtId, setCourtId] = useState<string | null>(courts[0]?.id ?? null);
  const [date, setDate] = useState(todayStr());
  const [selected, setSelected] = useState<number[]>([]);
  const [paddles, setPaddles] = useState(0);
  const [occ, setOcc] = useState<Occ[]>([]);
  const [maint, setMaint] = useState<Maint[]>([]);

  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("GCash");
  const [qr, setQr] = useState<null | "GCash" | "Bank Transfer">(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [pay, setPay] = useState({ gcashNumber: "", bankAccount: "", gcashQr: null as string | null, bankQr: null as string | null });

  // payment display info comes from the client content model (phase 1)
  useEffect(() => {
    DB.load();
    setPay({
      gcashNumber: DB.data!.payment.gcashNumber,
      bankAccount: DB.data!.payment.bankAccount,
      gcashQr: DB.data!.payment.gcashQr,
      bankQr: DB.data!.payment.bankQr,
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!courtId) return;
    const [{ data: occRows }, { data: maintRows }] = await Promise.all([
      supabase.rpc("court_occupancy", { p_date: date, p_court: courtId }),
      supabase.from("maintenance").select("court_id,start_hour,end_hour").eq("date", date),
    ]);
    setOcc(((occRows as any[]) ?? []).map((r) => ({ start: r.start_hour, end: r.end_hour, userId: r.user_id })));
    setMaint(((maintRows as any[]) ?? []).map((m) => ({ courtId: m.court_id, start: m.start_hour, end: m.end_hour })));
  }, [supabase, date, courtId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const court = courts.find((c) => c.id === courtId) || null;
  const courtIndex = courts.findIndex((c) => c.id === courtId);

  function maintenanceAt(hour: number) {
    return maint.find((m) => (m.courtId === "all" || m.courtId === courtId) && hour >= m.start && hour < m.end) || null;
  }
  function slotBooked(hour: number) {
    return occ.find((b) => hour >= b.start && hour < b.end) || null;
  }

  function slotState(hour: number): { cls: string; label: string } {
    const now = new Date();
    const isToday = date === todayStr();
    if (date < todayStr() || (isToday && hour <= now.getHours())) return { cls: "past", label: "Past" };
    if (maintenanceAt(hour)) return { cls: "maint", label: "Maintenance" };
    const bk = slotBooked(hour);
    if (bk) {
      return bk.userId === user?.id ? { cls: "mine", label: "Your booking" } : { cls: "booked", label: "Booked" };
    }
    if (selected.includes(hour)) return { cls: "selected", label: "Selected" };
    return { cls: "available", label: "Available" };
  }

  function toggleSlot(hour: number) {
    setSelected((prev) => {
      const sel = [...prev];
      const i = sel.indexOf(hour);
      if (i >= 0) {
        sel.splice(i, 1);
        sel.sort((a, b) => a - b);
        for (let k = 1; k < sel.length; k++) {
          if (sel[k] !== sel[k - 1] + 1) {
            return hour - sel[0] <= sel[sel.length - 1] - hour ? sel.slice(k) : sel.slice(0, k);
          }
        }
        return sel;
      }
      if (sel.length && hour !== Math.min(...sel) - 1 && hour !== Math.max(...sel) + 1) return [hour];
      return [...sel, hour];
    });
  }

  function changeCourt(id: string) {
    setCourtId(id);
    setSelected([]);
  }
  function changeDate(d: string) {
    setDate(d);
    setSelected([]);
  }

  const hours = selected.length;
  const from = hours ? Math.min(...selected) : 0;
  const to = hours ? Math.max(...selected) + 1 : 0;

  const dates = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      out.push(d);
    }
    return out;
  }, []);

  function openPayment() {
    if (!selected.length) return;
    setPaddles(0);
    setPayMethod("GCash");
    setPayOpen(true);
  }

  function selectMethod(m: string) {
    setPayMethod(m);
    if (m === "GCash" || m === "Bank Transfer") setQr(m as "GCash" | "Bank Transfer");
  }

  async function confirm() {
    const res = await createBooking({ courtId: courtId!, date, start: from, end: to, paddles, payMethod });
    if (!res.ok || !res.receipt) {
      setPayOpen(false);
      setSelected([]);
      await refresh();
      return toast(res.error || "Could not complete the booking.", "error");
    }
    const r = res.receipt;
    // client-side notification for the bell (phase 1)
    DB.load();
    DB.notify(
      user!.id,
      `Booking confirmed: ${court!.name}, ${fmtDateLong(r.date)} ${fmtHour(r.start)}–${fmtHour(r.end)} (Ref ${r.ref}).`,
      "success",
    );
    setPayOpen(false);
    setReceipt({
      ref: r.ref,
      courtName: court!.name,
      date: r.date,
      start: r.start,
      end: r.end,
      paddles: r.paddles,
      amount: r.amount,
      payMethod: r.payMethod,
      payStatus: r.payStatus,
    });
    setSelected([]);
    setPaddles(0);
    await refresh();
  }

  // ---- payment details rows (mirrors renderPayDetails) ----
  const fullHrs = Math.min(hours, settings.discountAfterHours);
  const extraHrs = Math.max(0, hours - settings.discountAfterHours);
  const paddleCost = paddles * settings.paddleRentPerHour * hours;

  return (
    <>
      <main className="page-wrap">
        <div className="page-head">
          <h1>Book a Court</h1>
          <p className="muted">
            Open daily <strong>{`${fmtHour(settings.openHour)} – ${fmtHour(settings.closeHour)}`}</strong> · minimum 1
            hour per booking · select consecutive slots for longer sessions.
          </p>
        </div>

        <div className="book-controls">
          <div className="control">
            <span className="control-label">Court</span>
            <div className="court-tabs">
              {courts.length ? (
                courts.map((c) => (
                  <button
                    key={c.id}
                    className={`court-tab ${c.id === courtId ? "active" : ""}`}
                    onClick={() => changeCourt(c.id)}
                  >
                    {c.name}
                  </button>
                ))
              ) : (
                <span className="muted">No courts are currently open.</span>
              )}
            </div>
            <div className={`court-photo ${courtId ? "" : "hidden"}`}>
              {court && <CourtPhoto key={courtId!} n={courtIndex + 1} name={court.name} />}
              <span className="court-photo-name">{court?.name ?? ""}</span>
            </div>
          </div>
          <div className="control">
            <span className="control-label">Date</span>
            <div className="date-strip">
              {dates.map((d) => {
                const str = dateToStr(d);
                return (
                  <button
                    key={str}
                    className={`date-chip ${str === date ? "active" : ""}`}
                    onClick={() => changeDate(str)}
                  >
                    <span className="dow">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                    <span className="dom">{d.getDate()}</span>
                    <span className="mon">{d.toLocaleDateString(undefined, { month: "short" })}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="legend-row">
          <span className="lg">
            <i className="sw available"></i> Available
          </span>
          <span className="lg">
            <i className="sw booked"></i> Booked
          </span>
          <span className="lg">
            <i className="sw mine"></i> Your booking
          </span>
          <span className="lg">
            <i className="sw maint"></i> Maintenance
          </span>
          <span className="lg">
            <i className="sw past"></i> Past
          </span>
          <span className="lg">
            <i className="sw selected"></i> Selected
          </span>
        </div>

        <div className="slot-grid">
          {courtId &&
            Array.from({ length: settings.closeHour - settings.openHour }, (_, k) => settings.openHour + k).map((h) => {
              const st = slotState(h);
              const clickable = st.cls === "available" || st.cls === "selected";
              return (
                <div
                  key={h}
                  className={`slot ${st.cls}`}
                  onClick={clickable ? () => toggleSlot(h) : undefined}
                >
                  <div className="slot-time">
                    {fmtHour(h)} – {fmtHour(h + 1)}
                  </div>
                  <div className="slot-state">
                    <span>{st.label}</span>
                  </div>
                </div>
              );
            })}
        </div>

        <div className={`book-summary ${hours ? "" : "hidden"}`}>
          <div className="summary-info">
            <strong>
              {court?.name} · {fmtDateLong(date)} · {fmtHour(from)} – {fmtHour(to)} ({hours} hr{hours > 1 ? "s" : ""})
            </strong>
            <span className="price">
              {money(settings, calcCourtCost(settings, hours))} court fee
              {hours > settings.discountAfterHours ? " · multi-hour discount applied ✓" : ""}
            </span>
          </div>
          <div className="row gap">
            <button className="btn ghost" onClick={() => setSelected([])}>
              Clear
            </button>
            <button className="btn primary" onClick={openPayment}>
              Proceed to Payment →
            </button>
          </div>
        </div>
      </main>

      {/* Payment modal */}
      <div className={`modal-backdrop ${payOpen ? "" : "hidden"}`}>
        <div className="modal wide">
          <h3>Confirm &amp; Pay</h3>
          <div className="pay-details">
            <div className="pd-row">
              <span>Court</span>
              <span>{court?.name}</span>
            </div>
            <div className="pd-row">
              <span>Date</span>
              <span>{fmtDateLong(date)}</span>
            </div>
            <div className="pd-row">
              <span>Time</span>
              <span>
                {fmtHour(from)} – {fmtHour(to)}
              </span>
            </div>
            <div className="pd-row">
              <span>
                Court fee ({fullHrs} hr × {money(settings, settings.pricePerHour)})
              </span>
              <span>{money(settings, fullHrs * settings.pricePerHour)}</span>
            </div>
            {extraHrs > 0 && (
              <div className="pd-row">
                <span>
                  Discounted hours ({extraHrs} hr × {money(settings, settings.pricePerHour - settings.discountPerHour)})
                </span>
                <span>{money(settings, extraHrs * (settings.pricePerHour - settings.discountPerHour))}</span>
              </div>
            )}
            {paddles > 0 && (
              <div className="pd-row">
                <span>
                  Paddle rental ({paddles} × {hours} hr × {money(settings, settings.paddleRentPerHour)})
                </span>
                <span>{money(settings, paddleCost)}</span>
              </div>
            )}
            <div className="pd-row total">
              <span>Total</span>
              <span>{money(settings, calcTotal(settings, hours, paddles))}</span>
            </div>
          </div>

          <div className="paddle-row">
            <div>
              <strong>🏓 Paddle rental</strong>
              <div className="muted small">₱{settings.paddleRentPerHour} per paddle, per hour</div>
            </div>
            <div className="qty-ctrl">
              <button type="button" className="qty-btn" onClick={() => setPaddles((p) => Math.max(0, p - 1))}>
                −
              </button>
              <span className="qty-num">{paddles}</span>
              <button type="button" className="qty-btn" onClick={() => setPaddles((p) => Math.min(8, p + 1))}>
                +
              </button>
            </div>
          </div>

          <div className="pay-methods">
            {["GCash", "Bank Transfer", "Pay at venue"].map((m) => (
              <label className="pay-option" key={m}>
                <input
                  type="radio"
                  name="payMethod"
                  value={m}
                  checked={payMethod === m}
                  onChange={() => selectMethod(m)}
                />
                <span>
                  {m === "GCash" && (
                    <>
                      📱 GCash <em className="muted small">(scan QR, then upload proof)</em>
                    </>
                  )}
                  {m === "Bank Transfer" && (
                    <>
                      🏦 Bank Transfer <em className="muted small">(scan QR, then upload proof)</em>
                    </>
                  )}
                  {m === "Pay at venue" && <>🏟 Pay at Venue</>}
                </span>
              </label>
            ))}
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setPayOpen(false)}>
              Back
            </button>
            <button className="btn primary" onClick={confirm}>
              Confirm Booking
            </button>
          </div>
        </div>
      </div>

      {/* QR modal */}
      <div className={`modal-backdrop ${qr ? "" : "hidden"}`}>
        <div className="modal">
          <h3 className="center">{qr === "GCash" ? "Pay via GCash" : "Pay via Bank Transfer"}</h3>
          <div className="qr-wrap">
            {(() => {
              const isGcash = qr === "GCash";
              const img = isGcash ? pay.gcashQr : pay.bankQr;
              const num = isGcash ? pay.gcashNumber : pay.bankAccount;
              return (
                <>
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="Payment QR code" />
                  ) : (
                    <p className="muted small center">No QR code uploaded yet — use the number below.</p>
                  )}
                  <p className="qr-number">
                    {num
                      ? isGcash
                        ? `GCash No: ${num}`
                        : `Account No: ${num}`
                      : "Payment details not set up yet — please contact us or pay at the venue."}
                  </p>
                </>
              );
            })()}
            <p className="muted small center">
              Scan the QR or send the exact amount to the number above.
              <br />
              After confirming your booking, upload your <strong>proof of payment</strong> in My Bookings.
            </p>
          </div>
          <div className="modal-actions center">
            <button className="btn primary" onClick={() => setQr(null)}>
              Got It
            </button>
          </div>
        </div>
      </div>

      {/* Receipt modal */}
      <div className={`modal-backdrop ${receipt ? "" : "hidden"}`}>
        <div className="modal">
          <div className="receipt-check">✔</div>
          <h3 className="center">Booking Confirmed!</h3>
          {receipt && (
            <div className="receipt-body">
              <div className="pd-row">
                <span>Reference</span>
                <strong>{receipt.ref}</strong>
              </div>
              <div className="pd-row">
                <span>Court</span>
                <span>{receipt.courtName}</span>
              </div>
              <div className="pd-row">
                <span>Date</span>
                <span>{fmtDateLong(receipt.date)}</span>
              </div>
              <div className="pd-row">
                <span>Time</span>
                <span>
                  {fmtHour(receipt.start)} – {fmtHour(receipt.end)}
                </span>
              </div>
              {receipt.paddles ? (
                <div className="pd-row">
                  <span>Paddles</span>
                  <span>{receipt.paddles}</span>
                </div>
              ) : null}
              <div className="pd-row">
                <span>Payment</span>
                <span>
                  {receipt.payMethod} · {receipt.payStatus}
                </span>
              </div>
              <div className="pd-row total">
                <span>Total</span>
                <strong>{money(settings, receipt.amount)}</strong>
              </div>
              {receipt.payStatus === "pending" && (
                <p className="muted small center" style={{ marginTop: ".6rem" }}>
                  ⚠ Please upload your proof of payment in <strong>My Bookings</strong> so we can verify it.
                </p>
              )}
            </div>
          )}
          <div className="modal-actions center">
            <Link className="btn ghost" href="/my-bookings">
              My Bookings
            </Link>
            <button className="btn primary" onClick={() => setReceipt(null)}>
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
