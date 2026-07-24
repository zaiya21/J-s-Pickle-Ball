"use client";
/* Admin dashboard — ported from admin.html + js/admin.js, operating on the
   client content model (clientDb) for phase 1. Same markup/classes and the same
   six tabs (overview, bookings, users, courts & maintenance, reviews, settings),
   including the printable daily earnings report and the div bar charts. */
import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { useToast } from "@/components/toast";
import { DB, DB_KEY, seedClientDb } from "@/lib/clientDb";
import {
  GALLERY_PLACEHOLDER,
  calcCourtCost,
  dateToStr,
  escapeHtml,
  fmtDateLong,
  fmtHour,
  imageFileToDataURL,
  timeAgo,
  todayStr,
} from "@/lib/helpers";

type Tab = "overview" | "bookings" | "users" | "courts" | "reviews" | "settings";

function ThumbImg({
  override,
  base,
  className,
  alt,
}: {
  override?: string | null;
  base?: number | null;
  className?: string;
  alt: string;
}) {
  const cands = override
    ? [override]
    : base
      ? [`/p${base}.jpg`, `/p${base}.png`, `/p${base}.jpeg`, `/p${base}.webp`]
      : [];
  const [idx, setIdx] = useState(0);
  const src = idx < cands.length ? cands[idx] : GALLERY_PLACEHOLDER;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={src} alt={alt} onError={() => setIdx((i) => i + 1)} />;
}

function BarChart({ data, tip }: { data: { label: string; value: number }[]; tip: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div className="bar-col" key={i}>
          {d.value === max && max > 0 && <span className="bar-max-label">{d.value}</span>}
          <div className="bar" style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}>
            <span className="bar-tip">
              {d.label}: {tip(d.value)}
            </span>
          </div>
          <span className="bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminClient() {
  const me = useSession();
  const { toast, confirm, showImage } = useToast();
  const [ready, setReady] = useState(false);
  const [ver, setVer] = useState(0);
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState({ q: "", status: "all", date: "" });
  const [repDate, setRepDate] = useState(todayStr());

  useEffect(() => {
    seedClientDb().then(() => setReady(true));
  }, []);

  if (!ready) return <main className="page-wrap" />;
  const d = DB.data!;
  const bump = () => {
    DB.save();
    setVer((v) => v + 1);
  };
  const money = (n: number) => d.settings.currency + Number(n).toLocaleString();
  const courtName = (id: string) => (id === "all" ? "All courts" : d.courts.find((c: any) => c.id === id)?.name || "Court");
  const userName = (id: string) => DB.findUser(id)?.name || "Unknown";

  /* ---------------- image upload helper (compress + save w/ rollback) --------------- */
  async function uploadImage(file: File | undefined, apply: (dataURL: string) => void, rollback: () => void, opts?: { maxW?: number; q?: number }) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const dataURL = await imageFileToDataURL(file, opts?.maxW ?? 1000, opts?.q ?? 0.8);
      apply(dataURL);
      try {
        DB.save();
        setVer((v) => v + 1);
      } catch {
        rollback();
        toast("Storage is full — try a smaller image.", "error");
      }
    } catch {
      toast("Couldn't read that image file.", "error");
    }
  }

  /* ================= OVERVIEW ================= */
  function Overview() {
    const s = d.settings;
    const today = todayStr();
    const live = d.bookings.filter((b: any) => b.status !== "cancelled");
    const todays = live.filter((b: any) => b.date === today);
    const hoursToday = todays.reduce((t: number, b: any) => t + (b.end - b.start), 0);
    const capacityToday = (s.closeHour - s.openHour) * d.courts.filter((c: any) => c.active).length;
    const occupancy = capacityToday ? Math.round((hoursToday / capacityToday) * 100) : 0;

    const last7: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const dd = new Date();
      dd.setDate(dd.getDate() - i);
      last7.push(dateToStr(dd));
    }
    const paid = live.filter((b: any) => b.payStatus === "paid");
    const weekRevenue = paid.filter((b: any) => last7.includes(b.date)).reduce((t: number, b: any) => t + b.amount, 0);
    const members = d.users.filter((u: any) => u.role === "user" && u.active).length;

    const perDay = last7.map((dd) => ({
      label: new Date(dd + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" }),
      value: live.filter((b: any) => b.date === dd).length,
    }));
    const perHour = [];
    for (let h = s.openHour; h < s.closeHour; h++) {
      let n = 0;
      live.forEach((b: any) => {
        if (h >= b.start && h < b.end) n++;
      });
      perHour.push({ label: fmtHour(h).replace(":00 ", ""), value: n });
    }

    return (
      <>
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-num">{todays.length}</div><div className="kpi-label">Bookings today</div><div className="kpi-sub">{hoursToday} court-hours</div></div>
          <div className="kpi"><div className="kpi-num">{occupancy}%</div><div className="kpi-label">Occupancy today</div><div className="kpi-sub">of {capacityToday} available hours</div></div>
          <div className="kpi"><div className="kpi-num">{money(weekRevenue)}</div><div className="kpi-label">Revenue · last 7 days</div><div className="kpi-sub">paid bookings only</div></div>
          <div className="kpi"><div className="kpi-num">{members}</div><div className="kpi-label">Active members</div><div className="kpi-sub">{d.users.length} total accounts</div></div>
        </div>
        <div className="card chart-card">
          <div className="chart-title">Bookings — last 7 days</div>
          <BarChart data={perDay} tip={(v) => `${v} booking${v === 1 ? "" : "s"}`} />
        </div>
        <div className="card chart-card">
          <div className="chart-title">Most popular hours (all time, booked court-hours)</div>
          <BarChart data={perHour} tip={(v) => `${v} booking${v === 1 ? "" : "s"}`} />
        </div>
        <div className="card chart-card">
          <div className="chart-title">📄 Daily earnings report</div>
          <div className="filter-row" style={{ marginBottom: 0 }}>
            <input type="date" value={repDate} onChange={(e) => setRepDate(e.target.value)} />
            <button className="btn primary small-btn" onClick={() => (repDate ? exportDailyReport(repDate) : toast("Pick a date first.", "error"))}>
              Export PDF
            </button>
            <span className="muted small">Opens a print view — pick &quot;Save as PDF&quot; as the printer.</span>
          </div>
        </div>
      </>
    );
  }

  function exportDailyReport(date: string) {
    const bookings = d.bookings.filter((b: any) => b.date === date).sort((a: any, b: any) => a.start - b.start);
    const active = bookings.filter((b: any) => b.status !== "cancelled");
    const cancelled = bookings.filter((b: any) => b.status === "cancelled");
    const sum = (list: any[]) => list.reduce((t, b) => t + b.amount, 0);
    const paidTotal = sum(active.filter((b: any) => b.payStatus === "paid"));
    const unpaidTotal = sum(active.filter((b: any) => b.payStatus === "unpaid" || b.payStatus === "pending"));
    const refundTotal = sum(cancelled.filter((b: any) => b.payStatus === "refunded"));
    const hours = active.reduce((t: number, b: any) => t + (b.end - b.start), 0);
    const paddles = active.reduce((t: number, b: any) => t + (b.paddles || 0), 0);
    const s = d.settings;
    const capacity = (s.closeHour - s.openHour) * d.courts.filter((c: any) => c.active).length;
    const m = (n: number) => "₱" + Number(n).toLocaleString();
    const logo = `${location.origin}/Pickle%20Ball%20Logo.jpg`;
    const row = (b: any) => `
      <tr class="${b.status === "cancelled" ? "cxl" : ""}">
        <td>${b.ref}</td><td>${escapeHtml(userName(b.userId))}</td><td>${escapeHtml(courtName(b.courtId))}</td>
        <td>${fmtHour(b.start)} – ${fmtHour(b.end)}</td><td>${b.end - b.start}</td><td>${b.paddles || 0}</td>
        <td>${b.payMethod}</td><td>${b.payStatus}</td><td class="r">${m(b.amount)}</td>
      </tr>`;
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Daily Report ${date} — J's Pickle Yard</title>
<style>
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1a1425; margin: 32px; }
  .head { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #7c3aed; padding-bottom: 14px; margin-bottom: 18px; }
  .head img { width: 70px; height: 70px; border-radius: 12px; object-fit: cover; }
  h1 { font-size: 22px; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
  .sub { color: #6b6280; font-size: 13px; margin-top: 2px; }
  .totals { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0 20px; }
  .tot { border: 1px solid #ddd6ee; border-radius: 10px; padding: 10px 16px; min-width: 130px; }
  .tot .n { font-size: 20px; font-weight: 700; color: #7c3aed; }
  .tot.main { background: #f5f0ff; border-color: #7c3aed; }
  .tot .l { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b6280; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .8px; color: #6b6280; border-bottom: 2px solid #7c3aed; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee8f8; }
  td.r, th.r { text-align: right; }
  tr.cxl td { color: #b0a8c4; text-decoration: line-through; }
  tfoot td { font-weight: 700; border-top: 2px solid #7c3aed; border-bottom: none; }
  h2 { font-size: 14px; margin: 22px 0 8px; text-transform: uppercase; letter-spacing: 1px; }
  .foot { margin-top: 26px; font-size: 11px; color: #6b6280; text-align: center; }
  .printbtn { display: block; margin: 0 0 18px auto; background: #7c3aed; color: #fff; border: none; border-radius: 8px; padding: 10px 22px; font-size: 14px; font-weight: 700; cursor: pointer; }
  @media print { .printbtn { display: none; } body { margin: 10mm; } }
</style></head><body>
  <button class="printbtn" onclick="print()">🖨 Print / Save as PDF</button>
  <div class="head"><img src="${logo}" alt="logo">
    <div><h1>J's Pickle Yard — Daily Earnings Report</h1>
      <div class="sub">${fmtDateLong(date)} &nbsp;·&nbsp; generated ${new Date().toLocaleString()}</div></div></div>
  <div class="totals">
    <div class="tot main"><div class="n">${m(paidTotal)}</div><div class="l">Total earnings (paid)</div></div>
    <div class="tot"><div class="n">${m(unpaidTotal)}</div><div class="l">Awaiting payment</div></div>
    <div class="tot"><div class="n">${m(refundTotal)}</div><div class="l">Refunded</div></div>
    <div class="tot"><div class="n">${active.length}</div><div class="l">Bookings</div></div>
    <div class="tot"><div class="n">${hours} / ${capacity}</div><div class="l">Court-hours used</div></div>
    <div class="tot"><div class="n">${paddles}</div><div class="l">Paddles rented</div></div></div>
  <h2>Bookings — ${fmtDateLong(date)}</h2>
  <table><thead><tr><th>Ref</th><th>Member</th><th>Court</th><th>Time</th><th>Hrs</th><th>Paddles</th><th>Method</th><th>Payment</th><th class="r">Amount</th></tr></thead>
    <tbody>${active.map(row).join("") || `<tr><td colspan="9" style="text-align:center;color:#6b6280">No bookings on this date.</td></tr>`}</tbody>
    <tfoot><tr><td colspan="8">Total collected (paid)</td><td class="r">${m(paidTotal)}</td></tr></tfoot></table>
  ${cancelled.length ? `<h2>Cancelled (${cancelled.length})</h2><table><thead><tr><th>Ref</th><th>Member</th><th>Court</th><th>Time</th><th>Hrs</th><th>Paddles</th><th>Method</th><th>Payment</th><th class="r">Amount</th></tr></thead><tbody>${cancelled.map(row).join("")}</tbody></table>` : ""}
  <div class="foot">J's Pickle Yard · Play • Connect • Compete · This report was generated from the booking system.</div>
  <script>window.onload = () => setTimeout(() => print(), 300);<\/script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return toast("Pop-up blocked — allow pop-ups for this site to export.", "error");
    w.document.write(html);
    w.document.close();
  }

  /* ================= BOOKINGS ================= */
  function Bookings() {
    let rows = d.bookings
      .slice()
      .sort((a: any, b: any) =>
        (b.date + String(b.start).padStart(2, "0")).localeCompare(a.date + String(a.start).padStart(2, "0")),
      );
    if (filter.status !== "all") rows = rows.filter((b: any) => b.status === filter.status);
    if (filter.date) rows = rows.filter((b: any) => b.date === filter.date);
    if (filter.q) {
      const q = filter.q.toLowerCase();
      rows = rows.filter((b: any) => b.ref.toLowerCase().includes(q) || userName(b.userId).toLowerCase().includes(q));
    }

    const markPaid = (b: any) => {
      b.payStatus = "paid";
      DB.notify(b.userId, `Payment received for booking ${b.ref}. See you on the court!`, "success");
      toast("Marked as paid.", "success");
      bump();
    };
    const cxl = async (b: any) => {
      const ok = await confirm(
        "Cancel this booking?",
        `${userName(b.userId)} · ${courtName(b.courtId)} · ${fmtDateLong(b.date)} ${fmtHour(b.start)}–${fmtHour(b.end)}. The member will be notified.`,
        "Cancel booking",
      );
      if (!ok) return;
      b.status = "cancelled";
      b.cancelledAt = Date.now();
      b.cancelledBy = "admin";
      if (b.payStatus === "paid") b.payStatus = "refunded";
      DB.notify(b.userId, `Your booking ${b.ref} on ${fmtDateLong(b.date)} was cancelled by the admin.`, "warn");
      toast("Booking cancelled.", "success");
      bump();
    };

    return (
      <>
        <div className="filter-row">
          <input
            type="text"
            placeholder="Search ref or member…"
            value={filter.q}
            onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
          />
          <input type="date" value={filter.date} onChange={(e) => setFilter((f) => ({ ...f, date: e.target.value }))} />
          <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
            <option value="all">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <span className="muted small">
            {rows.length} result{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Ref</th><th>Member</th><th>Court</th><th>Date</th><th>Time</th><th>Amount</th><th>Payment</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted center">No bookings found.</td>
                </tr>
              ) : (
                rows.map((b: any) => (
                  <tr key={b.id}>
                    <td>{b.ref}</td>
                    <td>{userName(b.userId)}</td>
                    <td>{courtName(b.courtId)}</td>
                    <td>{fmtDateLong(b.date)}</td>
                    <td>
                      {fmtHour(b.start)}–{fmtHour(b.end)}
                      {b.paddles ? ` · 🏓${b.paddles}` : ""}
                    </td>
                    <td>{money(b.amount)}</td>
                    <td>
                      {b.payMethod}
                      <br />
                      <span className="muted small">{b.payStatus}</span>
                      {b.proof && (
                        <>
                          <br />
                          <button className="link-btn" onClick={() => showImage(b.proof, "Proof of payment " + b.ref)}>
                            📎 view proof
                          </button>
                        </>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${b.status}`}>{b.status}</span>
                    </td>
                    <td className="row gap">
                      {b.status === "confirmed" && (b.payStatus === "unpaid" || b.payStatus === "pending") && (
                        <button className="mini-btn" onClick={() => markPaid(b)}>
                          Mark paid
                        </button>
                      )}
                      {b.status === "confirmed" && (
                        <button className="mini-btn danger" onClick={() => cxl(b)}>
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  /* ================= USERS ================= */
  function Users() {
    const users = d.users.slice().sort((a: any, b: any) => b.createdAt - a.createdAt);
    const count = (uid: string) => d.bookings.filter((b: any) => b.userId === uid && b.status !== "cancelled").length;
    const toggleRole = (u: any) => {
      u.role = u.role === "admin" ? "user" : "admin";
      toast(`${u.name} is now ${u.role === "admin" ? "an admin" : "a regular user"}.`, "success");
      bump();
    };
    const toggleActive = async (u: any) => {
      if (u.active) {
        const ok = await confirm("Disable account?", `${u.name} will no longer be able to sign in or book courts.`, "Disable");
        if (!ok) return;
      }
      u.active = !u.active;
      toast(`${u.name}'s account ${u.active ? "enabled" : "disabled"}.`, "success");
      bump();
    };
    return (
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Verified</th><th>Bookings</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.phone || "—"}</td>
                <td>
                  <span className={`badge ${u.role === "admin" ? "completed" : "pending"}`}>{u.role}</span>
                </td>
                <td>{u.verified ? "✅" : "—"}</td>
                <td>{count(u.id)}</td>
                <td>
                  <span className={`badge ${u.active ? "confirmed" : "cancelled"}`}>{u.active ? "active" : "disabled"}</span>
                </td>
                <td className="row gap">
                  {u.id === me?.id ? (
                    <span className="muted small">(you)</span>
                  ) : (
                    <>
                      <button className="mini-btn" onClick={() => toggleRole(u)}>
                        {u.role === "admin" ? "Make user" : "Make admin"}
                      </button>
                      <button className={`mini-btn ${u.active ? "danger" : ""}`} onClick={() => toggleActive(u)}>
                        {u.active ? "Disable" : "Enable"}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  /* ================= COURTS & MAINTENANCE ================= */
  function Courts() {
    const maint = d.maintenance.slice().sort((a: any, b: any) => a.date.localeCompare(b.date));
    const hourOptions = (selected: number) => {
      const s = d.settings;
      const out = [];
      for (let h = s.openHour; h <= s.closeHour; h++) out.push({ h, label: fmtHour(h), selected: h === selected });
      return out;
    };
    return (
      <>
        <div className="grid-2">
          <div className="card">
            <h3>Courts</h3>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Photo</th><th>Court</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {d.courts.map((c: any, i: number) => (
                    <tr key={c.id}>
                      <td>
                        <ThumbImg key={`${c.id}-${c.photo ? "o" : i}`} className="court-thumb" override={c.photo} base={i + 1} alt={`${c.name} photo`} />
                        <div className="row gap" style={{ marginTop: ".3rem" }}>
                          <label className="mini-btn" style={{ cursor: "pointer" }}>
                            Change
                            <input
                              type="file"
                              accept="image/*"
                              hidden
                              onChange={(e) => {
                                const prev = c.photo;
                                uploadImage(
                                  e.target.files?.[0],
                                  (url) => (c.photo = url),
                                  () => (c.photo = prev),
                                );
                              }}
                            />
                          </label>
                          {c.photo && (
                            <button
                              className="mini-btn danger"
                              onClick={() => {
                                delete c.photo;
                                toast(`${c.name} photo reset to default.`, "success");
                                bump();
                              }}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        {c.name}
                        <br />
                        <span className="muted small">{c.photo ? "custom photo" : "default photo"}</span>
                      </td>
                      <td>
                        <span className={`badge ${c.active ? "confirmed" : "cancelled"}`}>{c.active ? "open" : "closed"}</span>
                      </td>
                      <td className="row gap">
                        <button
                          className="mini-btn"
                          onClick={() => {
                            const name = prompt("New name for " + c.name + ":", c.name);
                            if (name && name.trim()) {
                              c.name = name.trim().slice(0, 30);
                              bump();
                            }
                          }}
                        >
                          Rename
                        </button>
                        <button
                          className={`mini-btn ${c.active ? "danger" : ""}`}
                          onClick={() => {
                            c.active = !c.active;
                            toast(`${c.name} is now ${c.active ? "open" : "closed"} for booking.`, "success");
                            bump();
                          }}
                        >
                          {c.active ? "Close" : "Open"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form
              className="inline-form"
              style={{ marginTop: ".9rem" }}
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const name = String(fd.get("newCourtName") || "").trim();
                if (!name) return;
                d.courts.push({ id: DB.nextId("c"), name, active: true, note: "" });
                toast(`${name} added.`, "success");
                (e.currentTarget as HTMLFormElement).reset();
                bump();
              }}
            >
              <label>
                New court name <input type="text" name="newCourtName" maxLength={30} placeholder="Court 4" required />
              </label>
              <button className="btn primary" type="submit">
                Add Court
              </button>
            </form>
          </div>

          <div className="card">
            <h3>Schedule maintenance</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const start = Number(fd.get("mStart"));
                const end = Number(fd.get("mEnd"));
                const date = String(fd.get("mDate") || "");
                if (end <= start) return toast("End time must be after start time.", "error");
                if (!date) return toast("Pick a date.", "error");
                const cid = String(fd.get("mCourt") || "all");
                const clash = d.bookings.filter(
                  (b: any) => b.status === "confirmed" && b.date === date && (cid === "all" || b.courtId === cid) && b.start < end && b.end > start,
                );
                d.maintenance.push({ id: DB.nextId("m"), courtId: cid, date, start, end, reason: String(fd.get("mReason") || "").trim() });
                toast(clash.length ? `Blocked — note: ${clash.length} existing booking(s) overlap this window.` : "Maintenance scheduled.", clash.length ? "warn" : "success");
                bump();
              }}
            >
              <label>
                Court
                <select name="mCourt" defaultValue="all">
                  <option value="all">All courts</option>
                  {d.courts.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date <input type="date" name="mDate" required min={todayStr()} />
              </label>
              <div className="inline-form">
                <label>
                  From
                  <select name="mStart" defaultValue={d.settings.openHour}>
                    {hourOptions(d.settings.openHour).map((o) => (
                      <option key={o.h} value={o.h}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  To
                  <select name="mEnd" defaultValue={d.settings.openHour + 1}>
                    {hourOptions(d.settings.openHour + 1).map((o) => (
                      <option key={o.h} value={o.h}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Reason <input type="text" name="mReason" maxLength={60} placeholder="Net repair, cleaning…" />
              </label>
              <button className="btn primary" type="submit">
                Block Slots
              </button>
            </form>
          </div>
        </div>

        <div className="card table-wrap" style={{ marginTop: "1rem" }}>
          <h3>Upcoming maintenance</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Court</th><th>Date</th><th>Time</th><th>Reason</th><th></th>
              </tr>
            </thead>
            <tbody>
              {maint.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted center">No maintenance scheduled.</td>
                </tr>
              ) : (
                maint.map((m: any) => (
                  <tr key={m.id}>
                    <td>{courtName(m.courtId)}</td>
                    <td>{fmtDateLong(m.date)}</td>
                    <td>
                      {fmtHour(m.start)}–{fmtHour(m.end)}
                    </td>
                    <td>{m.reason || "—"}</td>
                    <td>
                      <button
                        className="mini-btn danger"
                        onClick={() => {
                          d.maintenance = d.maintenance.filter((x: any) => x.id !== m.id);
                          bump();
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  /* ================= REVIEWS ================= */
  function Reviews() {
    const reviews = (d.reviews || []).slice().sort((a: any, b: any) => b.at - a.at);
    return (
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Player</th><th>Rating</th><th>Comment</th><th>Posted</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {reviews.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted center">
                  No player reviews yet — the landing page shows sample quotes until the first one arrives.
                </td>
              </tr>
            ) : (
              reviews.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>
                    <span className="stars-show">
                      {"★".repeat(r.rating)}
                      {"☆".repeat(5 - r.rating)}
                    </span>
                  </td>
                  <td style={{ maxWidth: 340 }}>{r.text}</td>
                  <td>{timeAgo(r.at)}</td>
                  <td>
                    <span className={`badge ${r.status === "published" ? "confirmed" : "cancelled"}`}>{r.status}</span>
                  </td>
                  <td className="row gap">
                    <button
                      className="mini-btn"
                      onClick={() => {
                        r.status = r.status === "published" ? "hidden" : "published";
                        toast(`Review ${r.status === "published" ? "published" : "hidden from the landing page"}.`, "success");
                        bump();
                      }}
                    >
                      {r.status === "published" ? "Hide" : "Publish"}
                    </button>
                    <button
                      className="mini-btn danger"
                      onClick={async () => {
                        const ok = await confirm("Delete review?", `Permanently remove ${r.name}'s ${r.rating}-star review.`, "Delete");
                        if (!ok) return;
                        d.reviews = d.reviews.filter((x: any) => x.id !== r.id);
                        bump();
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  /* ================= SETTINGS ================= */
  function Settings() {
    const s = d.settings;
    const allHourOptions = () => {
      const out = [];
      for (let h = 0; h <= 24; h++) out.push({ h, label: h === 24 ? "12:00 AM (midnight)" : fmtHour(h) });
      return out;
    };
    return (
      <div className="settings-grid">
        <div className="card">
          <h3>Operating hours</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const open = Number(fd.get("sOpen"));
              const close = Number(fd.get("sClose"));
              if (close <= open) return toast("Closing time must be after opening time.", "error");
              s.openHour = open;
              s.closeHour = close;
              toast("Operating hours saved.", "success");
              bump();
            }}
          >
            <label>
              Opens at
              <select name="sOpen" defaultValue={s.openHour}>
                {allHourOptions().map((o) => (
                  <option key={o.h} value={o.h}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Closes at
              <select name="sClose" defaultValue={s.closeHour}>
                {allHourOptions().map((o) => (
                  <option key={o.h} value={o.h}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn primary" type="submit">
              Save Hours
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Pricing (₱)</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const price = Number(fd.get("sPrice"));
              const disc = Number(fd.get("sDisc"));
              if (disc > price) return toast("Discount cannot exceed the hourly rate.", "error");
              s.pricePerHour = price;
              s.discountAfterHours = Math.max(1, Number(fd.get("sAfter")));
              s.discountPerHour = disc;
              s.paddleRentPerHour = Number(fd.get("sPaddle"));
              toast("Pricing saved — the Pricing page updates automatically.", "success");
              bump();
            }}
          >
            <label>
              Court rate per hour <input type="number" name="sPrice" min={0} step={10} defaultValue={s.pricePerHour} />
            </label>
            <label>
              Full-rate hours before discount <input type="number" name="sAfter" min={1} max={8} defaultValue={s.discountAfterHours} />
            </label>
            <label>
              Discount per extra hour <input type="number" name="sDisc" min={0} step={10} defaultValue={s.discountPerHour} />
            </label>
            <label>
              Paddle rental (per paddle / hour) <input type="number" name="sPaddle" min={0} step={10} defaultValue={s.paddleRentPerHour} />
            </label>
            <button className="btn primary" type="submit">
              Save Pricing
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Booking policy</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              s.cancelHours = Math.max(0, Number(fd.get("sCancel")));
              toast("Policy saved.", "success");
              bump();
            }}
          >
            <label>
              Free cancellation window (hours before start) <input type="number" name="sCancel" min={0} max={48} defaultValue={s.cancelHours} />
            </label>
            <button className="btn primary" type="submit">
              Save Policy
            </button>
          </form>
          <hr style={{ borderColor: "var(--border)", margin: "1.2rem 0" }} />
          <h3>Danger zone</h3>
          <p className="muted small">Erase every account, booking, and setting stored in this browser.</p>
          <button
            className="btn danger"
            onClick={async () => {
              const ok = await confirm(
                "Reset ALL data?",
                "This permanently deletes every user, booking, and setting in this browser.",
                "Erase everything",
              );
              if (!ok) return;
              localStorage.removeItem(DB_KEY);
              location.href = "/";
            }}
          >
            Reset All Data
          </button>
        </div>

        <div className="card" style={{ gridColumn: "1/-1" }}>
          <h3>Payment methods — GCash &amp; Bank</h3>
          <p className="muted small" style={{ marginBottom: ".9rem" }}>
            Shown to players when they choose GCash or Bank Transfer at checkout. Upload the QR codes from your GCash /
            bank app — players can view and download them.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              d.payment.gcashNumber = String(fd.get("payGcashNum") || "").trim();
              d.payment.bankAccount = String(fd.get("payBankNum") || "").trim();
              toast("Payment numbers saved.", "success");
              bump();
            }}
          >
            <div className="grid-2" style={{ marginBottom: 0 }}>
              <label>
                GCash number <input type="text" name="payGcashNum" maxLength={40} placeholder="0917 123 4567" defaultValue={d.payment.gcashNumber} />
              </label>
              <label>
                Bank account number <input type="text" name="payBankNum" maxLength={60} placeholder="BDO · 1234-5678-90 · J's Pickle Yard" defaultValue={d.payment.bankAccount} />
              </label>
            </div>
            <button className="btn primary" type="submit">
              Save Payment Numbers
            </button>
          </form>
          <div className="gallery-admin" style={{ marginTop: "1.1rem" }}>
            {(["gcash", "bank"] as const).map((which) => {
              const key = which === "gcash" ? "gcashQr" : "bankQr";
              const has = !!(d.payment as any)[key];
              return (
                <div className="gal-slot" key={which}>
                  <ThumbImg key={`${which}-${has}`} className="qr-thumb" override={(d.payment as any)[key]} alt={`${which} QR code`} />
                  <span className="gal-label">
                    {which === "gcash" ? "GCash QR " : "Bank QR "}
                    {has ? "· uploaded" : "· none"}
                  </span>
                  <div className="row gap">
                    <label className="mini-btn" style={{ cursor: "pointer" }}>
                      Change
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => {
                          const prev = (d.payment as any)[key];
                          uploadImage(
                            e.target.files?.[0],
                            (url) => ((d.payment as any)[key] = url),
                            () => ((d.payment as any)[key] = prev),
                            { maxW: 700, q: 0.85 },
                          );
                        }}
                      />
                    </label>
                    {has && (
                      <button
                        className="mini-btn danger"
                        onClick={() => {
                          (d.payment as any)[key] = null;
                          toast("QR code removed.", "success");
                          bump();
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ gridColumn: "1/-1" }}>
          <h3>Contact us — get in touch</h3>
          <p className="muted small" style={{ marginBottom: ".9rem" }}>
            Shown on the Contacts page and in the home page&apos;s &quot;Find The Yard&quot; section.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              d.contact.address = String(fd.get("ciAddress") || "").trim();
              d.contact.phone = String(fd.get("ciPhone") || "").trim();
              d.contact.email = String(fd.get("ciEmail") || "").trim();
              d.contact.socials = String(fd.get("ciSocials") || "").trim();
              d.contact.note = String(fd.get("ciNote") || "").trim();
              toast("Contact info saved — Contacts page and home page updated.", "success");
              bump();
            }}
          >
            <div className="grid-2" style={{ marginBottom: 0 }}>
              <label>
                Address <input type="text" name="ciAddress" maxLength={120} defaultValue={d.contact.address} />
              </label>
              <label>
                Phone / Viber <input type="text" name="ciPhone" maxLength={40} defaultValue={d.contact.phone} />
              </label>
              <label>
                Email <input type="email" name="ciEmail" maxLength={80} defaultValue={d.contact.email} />
              </label>
              <label>
                Socials <input type="text" name="ciSocials" maxLength={120} defaultValue={d.contact.socials} />
              </label>
            </div>
            <label>
              Directions / parking note <input type="text" name="ciNote" maxLength={160} defaultValue={d.contact.note} />
            </label>
            <button className="btn primary" type="submit">
              Save Contact Info
            </button>
          </form>
        </div>

        <div className="card" style={{ gridColumn: "1/-1" }}>
          <h3>Homepage gallery (10 photos)</h3>
          <p className="muted small" style={{ marginBottom: ".9rem" }}>
            These rotate in the &quot;Inside The Yard&quot; slideshow on the home page. Uploads replace the default
            p1.jpg–p10.jpg files (stored in this browser); Reset returns a slot to its default file. Slots with no upload
            and no matching file are skipped by the slideshow.
          </p>
          <div className="gallery-admin">
            {Array.from({ length: 10 }, (_, i) => i).map((i) => {
              const ov = (d.gallery || [])[i];
              return (
                <div className="gal-slot" key={i}>
                  <ThumbImg key={`g${i}-${ov ? "o" : "d"}`} override={ov} base={i + 1} alt={`Gallery photo ${i + 1}`} />
                  <span className="gal-label">
                    Photo {i + 1}
                    {ov ? " · custom" : " · default"}
                  </span>
                  <div className="row gap">
                    <label className="mini-btn" style={{ cursor: "pointer" }}>
                      Change
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => {
                          if (!d.gallery) d.gallery = new Array(10).fill(null);
                          const prev = d.gallery[i];
                          uploadImage(
                            e.target.files?.[0],
                            (url) => (d.gallery[i] = url),
                            () => (d.gallery[i] = prev),
                          );
                        }}
                      />
                    </label>
                    {ov && (
                      <button
                        className="mini-btn danger"
                        onClick={() => {
                          d.gallery[i] = null;
                          toast(`Photo ${i + 1} reset to default (p${i + 1}.jpg).`, "success");
                          bump();
                        }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const TABS: [Tab, string][] = [
    ["overview", "Overview"],
    ["bookings", "Bookings"],
    ["users", "Users"],
    ["courts", "Courts & Maintenance"],
    ["reviews", "Reviews"],
    ["settings", "Settings"],
  ];

  return (
    <main className="page-wrap">
      <div className="page-head">
        <h1>Admin Dashboard</h1>
      </div>

      <div className="tab-row">
        {TABS.map(([t, label]) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      <div id="adminBody" key={`${tab}-${ver}`}>
        {tab === "overview" && <Overview />}
        {tab === "bookings" && <Bookings />}
        {tab === "users" && <Users />}
        {tab === "courts" && <Courts />}
        {tab === "reviews" && <Reviews />}
        {tab === "settings" && <Settings />}
      </div>
    </main>
  );
}
