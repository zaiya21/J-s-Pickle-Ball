/* ============ Admin dashboard (admin.html) ============ */
const Admin = {
  tab: "overview",
  bookingFilter: { q: "", status: "all", date: "" },

  courtName(id) {
    if (id === "all") return "All courts";
    const c = DB.data.courts.find((c) => c.id === id);
    return c ? c.name : "Court";
  },
  userName(id) {
    const u = DB.findUser(id);
    return u ? u.name : "Unknown";
  },

  show(tab) {
    this.tab = tab;
    document.querySelectorAll("[data-atab]").forEach((t) =>
      t.classList.toggle("active", t.dataset.atab === tab));
    this["render_" + tab]();
  },

  /* ================= OVERVIEW ================= */
  render_overview() {
    const s = DB.data.settings;
    const today = todayStr();
    const live = DB.data.bookings.filter((b) => b.status !== "cancelled");

    const todays = live.filter((b) => b.date === today);
    const hoursToday = todays.reduce((t, b) => t + (b.end - b.start), 0);
    const capacityToday = (s.closeHour - s.openHour) * DB.data.courts.filter((c) => c.active).length;
    const occupancy = capacityToday ? Math.round((hoursToday / capacityToday) * 100) : 0;

    // last 7 days revenue (paid only)
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7.push(dateToStr(d));
    }
    const paid = live.filter((b) => b.payStatus === "paid");
    const weekRevenue = paid
      .filter((b) => last7.includes(b.date))
      .reduce((t, b) => t + b.amount, 0);
    const members = DB.data.users.filter((u) => u.role === "user" && u.active).length;

    // bookings per day (next/last mix: show last 7 days)
    const perDay = last7.map((d) => ({
      key: d,
      label: new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" }),
      value: live.filter((b) => b.date === d).length,
    }));

    // popular hours (all-time, confirmed)
    const perHour = [];
    for (let h = s.openHour; h < s.closeHour; h++) {
      let n = 0;
      live.forEach((b) => { if (h >= b.start && h < b.end) n++; });
      perHour.push({ key: h, label: fmtHour(h).replace(":00 ", ""), value: n });
    }

    document.getElementById("adminBody").innerHTML = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-num">${todays.length}</div><div class="kpi-label">Bookings today</div><div class="kpi-sub">${hoursToday} court-hours</div></div>
        <div class="kpi"><div class="kpi-num">${occupancy}%</div><div class="kpi-label">Occupancy today</div><div class="kpi-sub">of ${capacityToday} available hours</div></div>
        <div class="kpi"><div class="kpi-num">${fmtMoney(weekRevenue)}</div><div class="kpi-label">Revenue · last 7 days</div><div class="kpi-sub">paid bookings only</div></div>
        <div class="kpi"><div class="kpi-num">${members}</div><div class="kpi-label">Active members</div><div class="kpi-sub">${DB.data.users.length} total accounts</div></div>
      </div>
      <div class="card chart-card">
        <div class="chart-title">Bookings — last 7 days</div>
        ${this.barChart(perDay, (v) => `${v} booking${v === 1 ? "" : "s"}`)}
      </div>
      <div class="card chart-card">
        <div class="chart-title">Most popular hours (all time, booked court-hours)</div>
        ${this.barChart(perHour, (v) => `${v} booking${v === 1 ? "" : "s"}`)}
      </div>
      <div class="card chart-card">
        <div class="chart-title">📄 Daily earnings report</div>
        <div class="filter-row" style="margin-bottom:0">
          <input type="date" id="repDate" value="${today}">
          <button class="btn primary small-btn" id="repBtn">Export PDF</button>
          <span class="muted small">Opens a print view — pick "Save as PDF" as the printer.</span>
        </div>
      </div>`;

    document.getElementById("repBtn").addEventListener("click", () => {
      const d = document.getElementById("repDate").value;
      if (!d) return toast("Pick a date first.", "error");
      this.exportDailyReport(d);
    });
  },

  /* Build a print-ready daily report in a new window; user saves it as PDF */
  exportDailyReport(date) {
    const bookings = DB.data.bookings
      .filter((b) => b.date === date)
      .sort((a, b) => a.start - b.start);
    const active = bookings.filter((b) => b.status !== "cancelled");
    const cancelled = bookings.filter((b) => b.status === "cancelled");

    const sum = (list) => list.reduce((t, b) => t + b.amount, 0);
    const paidTotal = sum(active.filter((b) => b.payStatus === "paid"));
    const unpaidTotal = sum(active.filter((b) => b.payStatus === "unpaid" || b.payStatus === "pending"));
    const refundTotal = sum(cancelled.filter((b) => b.payStatus === "refunded"));
    const hours = active.reduce((t, b) => t + (b.end - b.start), 0);
    const paddles = active.reduce((t, b) => t + (b.paddles || 0), 0);
    const s = DB.data.settings;
    const capacity = (s.closeHour - s.openHour) * DB.data.courts.filter((c) => c.active).length;
    const money = (n) => "₱" + Number(n).toLocaleString();
    const logo = location.href.replace(/[^/\\]*$/, "") + "Pickle%20Ball%20Logo.jpg";

    const row = (b) => `
      <tr class="${b.status === "cancelled" ? "cxl" : ""}">
        <td>${b.ref}</td>
        <td>${escapeHtml(this.userName(b.userId))}</td>
        <td>${escapeHtml(this.courtName(b.courtId))}</td>
        <td>${fmtHour(b.start)} – ${fmtHour(b.end)}</td>
        <td>${b.end - b.start}</td>
        <td>${b.paddles || 0}</td>
        <td>${b.payMethod}</td>
        <td>${b.payStatus}</td>
        <td class="r">${money(b.amount)}</td>
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
  <div class="head">
    <img src="${logo}" alt="logo">
    <div>
      <h1>J's Pickle Yard — Daily Earnings Report</h1>
      <div class="sub">${fmtDateLong(date)} &nbsp;·&nbsp; generated ${new Date().toLocaleString()}</div>
    </div>
  </div>

  <div class="totals">
    <div class="tot main"><div class="n">${money(paidTotal)}</div><div class="l">Total earnings (paid)</div></div>
    <div class="tot"><div class="n">${money(unpaidTotal)}</div><div class="l">Awaiting payment</div></div>
    <div class="tot"><div class="n">${money(refundTotal)}</div><div class="l">Refunded</div></div>
    <div class="tot"><div class="n">${active.length}</div><div class="l">Bookings</div></div>
    <div class="tot"><div class="n">${hours} / ${capacity}</div><div class="l">Court-hours used</div></div>
    <div class="tot"><div class="n">${paddles}</div><div class="l">Paddles rented</div></div>
  </div>

  <h2>Bookings — ${fmtDateLong(date)}</h2>
  <table>
    <thead><tr>
      <th>Ref</th><th>Member</th><th>Court</th><th>Time</th><th>Hrs</th>
      <th>Paddles</th><th>Method</th><th>Payment</th><th class="r">Amount</th>
    </tr></thead>
    <tbody>
      ${active.map(row).join("") || `<tr><td colspan="9" style="text-align:center;color:#6b6280">No bookings on this date.</td></tr>`}
    </tbody>
    <tfoot><tr>
      <td colspan="8">Total collected (paid)</td><td class="r">${money(paidTotal)}</td>
    </tr></tfoot>
  </table>

  ${cancelled.length ? `
  <h2>Cancelled (${cancelled.length})</h2>
  <table>
    <thead><tr>
      <th>Ref</th><th>Member</th><th>Court</th><th>Time</th><th>Hrs</th>
      <th>Paddles</th><th>Method</th><th>Payment</th><th class="r">Amount</th>
    </tr></thead>
    <tbody>${cancelled.map(row).join("")}</tbody>
  </table>` : ""}

  <div class="foot">J's Pickle Yard · Play • Connect • Compete · This report was generated from the booking system.</div>
  <script>window.onload = () => setTimeout(() => print(), 300);<\/script>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) return toast("Pop-up blocked — allow pop-ups for this site to export.", "error");
    w.document.write(html);
    w.document.close();
  },

  /* Single-series bar chart in plain divs: hover tooltip on every bar,
     direct label only on the max (selective labeling). */
  barChart(data, tipFmt) {
    const max = Math.max(1, ...data.map((d) => d.value));
    return `<div class="bar-chart">
      ${data.map((d) => `
        <div class="bar-col">
          ${d.value === max && max > 0 ? `<span class="bar-max-label">${d.value}</span>` : ""}
          <div class="bar" style="height:${Math.max(2, (d.value / max) * 100)}%">
            <span class="bar-tip">${d.label}: ${tipFmt(d.value)}</span>
          </div>
          <span class="bar-label">${d.label}</span>
        </div>`).join("")}
    </div>`;
  },

  /* ================= BOOKINGS ================= */
  render_bookings() {
    const f = this.bookingFilter;
    let rows = DB.data.bookings.slice().sort((a, b) =>
      (b.date + String(b.start).padStart(2, "0")).localeCompare(a.date + String(a.start).padStart(2, "0")));

    if (f.status !== "all") rows = rows.filter((b) => b.status === f.status);
    if (f.date) rows = rows.filter((b) => b.date === f.date);
    if (f.q) {
      const q = f.q.toLowerCase();
      rows = rows.filter((b) =>
        b.ref.toLowerCase().includes(q) || this.userName(b.userId).toLowerCase().includes(q));
    }

    document.getElementById("adminBody").innerHTML = `
      <div class="filter-row">
        <input type="text" id="fQ" placeholder="Search ref or member…" value="${escapeHtml(f.q)}">
        <input type="date" id="fDate" value="${f.date}">
        <select id="fStatus">
          <option value="all" ${f.status === "all" ? "selected" : ""}>All statuses</option>
          <option value="confirmed" ${f.status === "confirmed" ? "selected" : ""}>Confirmed</option>
          <option value="cancelled" ${f.status === "cancelled" ? "selected" : ""}>Cancelled</option>
        </select>
        <span class="muted small">${rows.length} result${rows.length === 1 ? "" : "s"}</span>
      </div>
      <div class="card table-wrap">
        <table class="data">
          <thead><tr>
            <th>Ref</th><th>Member</th><th>Court</th><th>Date</th><th>Time</th>
            <th>Amount</th><th>Payment</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            ${rows.map((b) => `
              <tr>
                <td>${b.ref}</td>
                <td>${escapeHtml(this.userName(b.userId))}</td>
                <td>${escapeHtml(this.courtName(b.courtId))}</td>
                <td>${fmtDateLong(b.date)}</td>
                <td>${fmtHour(b.start)}–${fmtHour(b.end)}${b.paddles ? ` · 🏓${b.paddles}` : ""}</td>
                <td>${fmtMoney(b.amount)}</td>
                <td>${b.payMethod}<br><span class="muted small">${b.payStatus}</span>
                  ${b.proof ? `<br><button class="link-btn" data-proof="${b.id}">📎 view proof</button>` : ""}</td>
                <td><span class="badge ${b.status}">${b.status}</span></td>
                <td class="row gap">
                  ${b.status === "confirmed" && (b.payStatus === "unpaid" || b.payStatus === "pending")
                    ? `<button class="mini-btn" data-paid="${b.id}">Mark paid</button>` : ""}
                  ${b.status === "confirmed"
                    ? `<button class="mini-btn danger" data-cxl="${b.id}">Cancel</button>` : ""}
                </td>
              </tr>`).join("") || `<tr><td colspan="9" class="muted center">No bookings found.</td></tr>`}
          </tbody>
        </table>
      </div>`;

    document.getElementById("fQ").addEventListener("input", (e) => {
      this.bookingFilter.q = e.target.value;
      this.render_bookings();
      const el = document.getElementById("fQ");
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
    document.getElementById("fDate").addEventListener("change", (e) => {
      this.bookingFilter.date = e.target.value;
      this.render_bookings();
    });
    document.getElementById("fStatus").addEventListener("change", (e) => {
      this.bookingFilter.status = e.target.value;
      this.render_bookings();
    });

    document.querySelectorAll("[data-proof]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const b = DB.data.bookings.find((x) => x.id === btn.dataset.proof);
        if (b && b.proof) showImageOverlay(b.proof, "Proof of payment " + b.ref);
      }));

    document.querySelectorAll("[data-paid]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const b = DB.data.bookings.find((x) => x.id === btn.dataset.paid);
        b.payStatus = "paid";
        DB.save();
        DB.notify(b.userId, `Payment received for booking ${b.ref}. See you on the court!`, "success");
        toast("Marked as paid.", "success");
        this.render_bookings();
      }));

    document.querySelectorAll("[data-cxl]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const b = DB.data.bookings.find((x) => x.id === btn.dataset.cxl);
        const ok = await confirmDialog("Cancel this booking?",
          `${this.userName(b.userId)} · ${this.courtName(b.courtId)} · ${fmtDateLong(b.date)} ${fmtHour(b.start)}–${fmtHour(b.end)}. The member will be notified.`,
          "Cancel booking");
        if (!ok) return;
        b.status = "cancelled";
        b.cancelledAt = Date.now();
        b.cancelledBy = "admin";
        if (b.payStatus === "paid") b.payStatus = "refunded";
        DB.save();
        DB.notify(b.userId,
          `Your booking ${b.ref} on ${fmtDateLong(b.date)} was cancelled by the admin.${b.payStatus === "refunded" ? " A refund was issued." : ""}`,
          "warn");
        toast("Booking cancelled.", "success");
        this.render_bookings();
      }));
  },

  /* ================= USERS ================= */
  render_users() {
    const users = DB.data.users.slice().sort((a, b) => b.createdAt - a.createdAt);
    const count = (uid) =>
      DB.data.bookings.filter((b) => b.userId === uid && b.status !== "cancelled").length;

    document.getElementById("adminBody").innerHTML = `
      <div class="card table-wrap">
        <table class="data">
          <thead><tr>
            <th>Name</th><th>Email</th><th>Phone</th><th>Role</th>
            <th>Verified</th><th>Bookings</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            ${users.map((u) => `
              <tr>
                <td>${escapeHtml(u.name)}</td>
                <td>${escapeHtml(u.email)}</td>
                <td>${escapeHtml(u.phone || "—")}</td>
                <td><span class="badge ${u.role === "admin" ? "completed" : "pending"}">${u.role}</span></td>
                <td>${u.verified ? "✅" : "—"}</td>
                <td>${count(u.id)}</td>
                <td><span class="badge ${u.active ? "confirmed" : "cancelled"}">${u.active ? "active" : "disabled"}</span></td>
                <td class="row gap">
                  ${u.id === Shell.user.id ? `<span class="muted small">(you)</span>` : `
                    <button class="mini-btn" data-role="${u.id}">${u.role === "admin" ? "Make user" : "Make admin"}</button>
                    <button class="mini-btn ${u.active ? "danger" : ""}" data-toggle="${u.id}">${u.active ? "Disable" : "Enable"}</button>`}
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;

    document.querySelectorAll("[data-role]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const u = DB.findUser(btn.dataset.role);
        u.role = u.role === "admin" ? "user" : "admin";
        DB.save();
        toast(`${u.name} is now ${u.role === "admin" ? "an admin" : "a regular user"}.`, "success");
        this.render_users();
      }));

    document.querySelectorAll("[data-toggle]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const u = DB.findUser(btn.dataset.toggle);
        if (u.active) {
          const ok = await confirmDialog("Disable account?",
            `${u.name} will no longer be able to sign in or book courts.`, "Disable");
          if (!ok) return;
        }
        u.active = !u.active;
        DB.save();
        toast(`${u.name}'s account ${u.active ? "enabled" : "disabled"}.`, "success");
        this.render_users();
      }));
  },

  /* ================= COURTS & MAINTENANCE ================= */
  render_courts() {
    const maint = DB.data.maintenance.slice().sort((a, b) => a.date.localeCompare(b.date));
    document.getElementById("adminBody").innerHTML = `
      <div class="grid-2">
        <div class="card">
          <h3>Courts</h3>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Photo</th><th>Court</th><th>Status</th><th></th></tr></thead>
              <tbody>
                ${DB.data.courts.map((c) => `
                  <tr>
                    <td>
                      <img class="court-thumb" id="courtThumb_${c.id}" alt="${escapeHtml(c.name)} photo">
                      <div class="row gap" style="margin-top:.3rem">
                        <label class="mini-btn" style="cursor:pointer">Change
                          <input type="file" accept="image/*" data-cphoto="${c.id}" hidden>
                        </label>
                        ${c.photo ? `<button class="mini-btn danger" data-cphotoreset="${c.id}">Reset</button>` : ""}
                      </div>
                    </td>
                    <td>${escapeHtml(c.name)}${c.photo ? `<br><span class="muted small">custom photo</span>` : `<br><span class="muted small">default photo</span>`}</td>
                    <td><span class="badge ${c.active ? "confirmed" : "cancelled"}">${c.active ? "open" : "closed"}</span></td>
                    <td class="row gap">
                      <button class="mini-btn" data-rename="${c.id}">Rename</button>
                      <button class="mini-btn ${c.active ? "danger" : ""}" data-ctoggle="${c.id}">${c.active ? "Close" : "Open"}</button>
                    </td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>
          <form id="addCourtForm" class="inline-form" style="margin-top:.9rem">
            <label>New court name <input type="text" id="newCourtName" maxlength="30" placeholder="Court 4" required></label>
            <button class="btn primary" type="submit">Add Court</button>
          </form>
        </div>

        <div class="card">
          <h3>Schedule maintenance</h3>
          <form id="maintForm">
            <label>Court
              <select id="mCourt">
                <option value="all">All courts</option>
                ${DB.data.courts.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}
              </select>
            </label>
            <label>Date <input type="date" id="mDate" required min="${todayStr()}"></label>
            <div class="inline-form">
              <label>From
                <select id="mStart">${this.hourOptions(DB.data.settings.openHour)}</select>
              </label>
              <label>To
                <select id="mEnd">${this.hourOptions(DB.data.settings.openHour + 1)}</select>
              </label>
            </div>
            <label>Reason <input type="text" id="mReason" maxlength="60" placeholder="Net repair, cleaning…"></label>
            <button class="btn primary" type="submit">Block Slots</button>
          </form>
        </div>
      </div>

      <div class="card table-wrap" style="margin-top:1rem">
        <h3>Upcoming maintenance</h3>
        <table class="data">
          <thead><tr><th>Court</th><th>Date</th><th>Time</th><th>Reason</th><th></th></tr></thead>
          <tbody>
            ${maint.map((m) => `
              <tr>
                <td>${escapeHtml(this.courtName(m.courtId))}</td>
                <td>${fmtDateLong(m.date)}</td>
                <td>${fmtHour(m.start)}–${fmtHour(m.end)}</td>
                <td>${escapeHtml(m.reason || "—")}</td>
                <td><button class="mini-btn danger" data-mdel="${m.id}">Remove</button></td>
              </tr>`).join("") || `<tr><td colspan="5" class="muted center">No maintenance scheduled.</td></tr>`}
          </tbody>
        </table>
      </div>`;

    // court photo thumbnails + upload/reset
    DB.data.courts.forEach((c) =>
      setCourtImg(document.getElementById("courtThumb_" + c.id), c.id));

    document.querySelectorAll("[data-cphoto]").forEach((inp) =>
      inp.addEventListener("change", async () => {
        const c = DB.data.courts.find((x) => x.id === inp.dataset.cphoto);
        const file = inp.files[0];
        if (!c || !file || !file.type.startsWith("image/")) return;
        try {
          const dataURL = await imageFileToDataURL(file);
          const prev = c.photo;
          c.photo = dataURL;
          try {
            DB.save();
          } catch {
            c.photo = prev;
            return toast("Storage is full — try a smaller photo.", "error");
          }
          toast(`${c.name} photo updated — it now shows on the booking page.`, "success");
          this.render_courts();
        } catch {
          toast("Couldn't read that image file.", "error");
        }
      }));

    document.querySelectorAll("[data-cphotoreset]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const c = DB.data.courts.find((x) => x.id === btn.dataset.cphotoreset);
        delete c.photo;
        DB.save();
        toast(`${c.name} photo reset to default.`, "success");
        this.render_courts();
      }));

    document.querySelectorAll("[data-ctoggle]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const c = DB.data.courts.find((x) => x.id === btn.dataset.ctoggle);
        c.active = !c.active;
        DB.save();
        toast(`${c.name} is now ${c.active ? "open" : "closed"} for booking.`, "success");
        this.render_courts();
      }));

    document.querySelectorAll("[data-rename]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const c = DB.data.courts.find((x) => x.id === btn.dataset.rename);
        const name = prompt("New name for " + c.name + ":", c.name);
        if (name && name.trim()) {
          c.name = name.trim().slice(0, 30);
          DB.save();
          this.render_courts();
        }
      }));

    document.getElementById("addCourtForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("newCourtName").value.trim();
      if (!name) return;
      DB.data.courts.push({ id: DB.nextId("c"), name, active: true, note: "" });
      DB.save();
      toast(`${name} added.`, "success");
      this.render_courts();
    });

    document.getElementById("maintForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const start = Number(document.getElementById("mStart").value);
      const end = Number(document.getElementById("mEnd").value);
      const date = document.getElementById("mDate").value;
      if (end <= start) return toast("End time must be after start time.", "error");
      if (!date) return toast("Pick a date.", "error");
      const courtId = document.getElementById("mCourt").value;

      // Warn if existing bookings overlap the block
      const clash = DB.data.bookings.filter((b) =>
        b.status === "confirmed" && b.date === date &&
        (courtId === "all" || b.courtId === courtId) &&
        b.start < end && b.end > start);
      DB.data.maintenance.push({
        id: DB.nextId("m"),
        courtId, date, start, end,
        reason: document.getElementById("mReason").value.trim(),
      });
      DB.save();
      toast(clash.length
        ? `Blocked — note: ${clash.length} existing booking(s) overlap this window.`
        : "Maintenance scheduled.", clash.length ? "warn" : "success");
      this.render_courts();
    });

    document.querySelectorAll("[data-mdel]").forEach((btn) =>
      btn.addEventListener("click", () => {
        DB.data.maintenance = DB.data.maintenance.filter((m) => m.id !== btn.dataset.mdel);
        DB.save();
        this.render_courts();
      }));
  },

  /* ================= REVIEWS ================= */
  render_reviews() {
    const reviews = (DB.data.reviews || []).slice().sort((a, b) => b.at - a.at);
    document.getElementById("adminBody").innerHTML = `
      <div class="card table-wrap">
        <table class="data">
          <thead><tr>
            <th>Player</th><th>Rating</th><th>Comment</th><th>Posted</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            ${reviews.map((r) => `
              <tr>
                <td>${escapeHtml(r.name)}</td>
                <td><span class="stars-show">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span></td>
                <td style="max-width:340px">${escapeHtml(r.text)}</td>
                <td>${timeAgo(r.at)}</td>
                <td><span class="badge ${r.status === "published" ? "confirmed" : "cancelled"}">${r.status}</span></td>
                <td class="row gap">
                  <button class="mini-btn" data-rtoggle="${r.id}">${r.status === "published" ? "Hide" : "Publish"}</button>
                  <button class="mini-btn danger" data-rdel="${r.id}">Delete</button>
                </td>
              </tr>`).join("") || `<tr><td colspan="6" class="muted center">No player reviews yet — the landing page shows sample quotes until the first one arrives.</td></tr>`}
          </tbody>
        </table>
      </div>`;

    document.querySelectorAll("[data-rtoggle]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const r = DB.data.reviews.find((x) => x.id === btn.dataset.rtoggle);
        r.status = r.status === "published" ? "hidden" : "published";
        DB.save();
        toast(`Review ${r.status === "published" ? "published" : "hidden from the landing page"}.`, "success");
        this.render_reviews();
      }));

    document.querySelectorAll("[data-rdel]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const r = DB.data.reviews.find((x) => x.id === btn.dataset.rdel);
        const ok = await confirmDialog("Delete review?",
          `Permanently remove ${r.name}'s ${r.rating}-star review.`, "Delete");
        if (!ok) return;
        DB.data.reviews = DB.data.reviews.filter((x) => x.id !== r.id);
        DB.save();
        this.render_reviews();
      }));
  },

  hourOptions(selected) {
    const s = DB.data.settings;
    let out = "";
    for (let h = s.openHour; h <= s.closeHour; h++) {
      out += `<option value="${h}" ${h === selected ? "selected" : ""}>${fmtHour(h)}</option>`;
    }
    return out;
  },

  /* ================= SETTINGS ================= */
  render_settings() {
    const s = DB.data.settings;
    document.getElementById("adminBody").innerHTML = `
      <div class="settings-grid">
        <div class="card">
          <h3>Operating hours</h3>
          <form id="hoursForm">
            <label>Opens at
              <select id="sOpen">${this.allHourOptions(s.openHour)}</select>
            </label>
            <label>Closes at
              <select id="sClose">${this.allHourOptions(s.closeHour)}</select>
            </label>
            <button class="btn primary" type="submit">Save Hours</button>
          </form>
        </div>

        <div class="card">
          <h3>Pricing (₱)</h3>
          <form id="priceForm">
            <label>Court rate per hour
              <input type="number" id="sPrice" min="0" step="10" value="${s.pricePerHour}">
            </label>
            <label>Full-rate hours before discount
              <input type="number" id="sAfter" min="1" max="8" value="${s.discountAfterHours}">
            </label>
            <label>Discount per extra hour
              <input type="number" id="sDisc" min="0" step="10" value="${s.discountPerHour}">
            </label>
            <label>Paddle rental (per paddle / hour)
              <input type="number" id="sPaddle" min="0" step="10" value="${s.paddleRentPerHour}">
            </label>
            <button class="btn primary" type="submit">Save Pricing</button>
          </form>
        </div>

        <div class="card">
          <h3>Booking policy</h3>
          <form id="policyForm">
            <label>Free cancellation window (hours before start)
              <input type="number" id="sCancel" min="0" max="48" value="${s.cancelHours}">
            </label>
            <button class="btn primary" type="submit">Save Policy</button>
          </form>
          <hr style="border-color:var(--border);margin:1.2rem 0">
          <h3>Danger zone</h3>
          <p class="muted small">Erase every account, booking, and setting stored in this browser.</p>
          <button class="btn danger" id="wipeBtn">Reset All Data</button>
        </div>

        <div class="card" style="grid-column:1/-1">
          <h3>Payment methods — GCash &amp; Bank</h3>
          <p class="muted small" style="margin-bottom:.9rem">
            Shown to players when they choose GCash or Bank Transfer at checkout.
            Upload the QR codes from your GCash / bank app — players can view and download them.
          </p>
          <form id="payInfoForm">
            <div class="grid-2" style="margin-bottom:0">
              <label>GCash number
                <input type="text" id="payGcashNum" maxlength="40" placeholder="0917 123 4567"
                  value="${escapeHtml(DB.data.payment.gcashNumber)}">
              </label>
              <label>Bank account number
                <input type="text" id="payBankNum" maxlength="60" placeholder="BDO · 1234-5678-90 · J's Pickle Yard"
                  value="${escapeHtml(DB.data.payment.bankAccount)}">
              </label>
            </div>
            <button class="btn primary" type="submit">Save Payment Numbers</button>
          </form>
          <div class="gallery-admin" style="margin-top:1.1rem">
            <div class="gal-slot">
              <img class="qr-thumb" id="qrThumbGcash" alt="GCash QR code">
              <span class="gal-label">GCash QR ${DB.data.payment.gcashQr ? "· uploaded" : "· none"}</span>
              <div class="row gap">
                <label class="mini-btn" style="cursor:pointer">Change
                  <input type="file" accept="image/*" data-qr="gcash" hidden>
                </label>
                ${DB.data.payment.gcashQr ? `<button class="mini-btn danger" data-qrreset="gcash">Remove</button>` : ""}
              </div>
            </div>
            <div class="gal-slot">
              <img class="qr-thumb" id="qrThumbBank" alt="Bank QR code">
              <span class="gal-label">Bank QR ${DB.data.payment.bankQr ? "· uploaded" : "· none"}</span>
              <div class="row gap">
                <label class="mini-btn" style="cursor:pointer">Change
                  <input type="file" accept="image/*" data-qr="bank" hidden>
                </label>
                ${DB.data.payment.bankQr ? `<button class="mini-btn danger" data-qrreset="bank">Remove</button>` : ""}
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="grid-column:1/-1">
          <h3>Contact us — get in touch</h3>
          <p class="muted small" style="margin-bottom:.9rem">
            Shown on the Contacts page and in the home page's "Find The Yard" section.
          </p>
          <form id="contactInfoForm">
            <div class="grid-2" style="margin-bottom:0">
              <label>Address
                <input type="text" id="ciAddress" maxlength="120" value="${escapeHtml(DB.data.contact.address)}">
              </label>
              <label>Phone / Viber
                <input type="text" id="ciPhone" maxlength="40" value="${escapeHtml(DB.data.contact.phone)}">
              </label>
              <label>Email
                <input type="email" id="ciEmail" maxlength="80" value="${escapeHtml(DB.data.contact.email)}">
              </label>
              <label>Socials
                <input type="text" id="ciSocials" maxlength="120" value="${escapeHtml(DB.data.contact.socials)}">
              </label>
            </div>
            <label>Directions / parking note
              <input type="text" id="ciNote" maxlength="160" value="${escapeHtml(DB.data.contact.note)}">
            </label>
            <button class="btn primary" type="submit">Save Contact Info</button>
          </form>
        </div>

        <div class="card" style="grid-column:1/-1">
          <h3>Homepage gallery (10 photos)</h3>
          <p class="muted small" style="margin-bottom:.9rem">
            These rotate in the "Inside The Yard" slideshow on the home page.
            Uploads replace the default p1.jpg–p10.jpg files (stored in this browser); Reset returns a slot to its default file.
            Slots with no upload and no matching file are skipped by the slideshow.
          </p>
          <div class="gallery-admin" id="galleryAdmin">
            ${Array.from({ length: 10 }, (_, i) => i).map((i) => `
              <div class="gal-slot">
                <img id="galImg${i}" alt="Gallery photo ${i + 1}">
                <span class="gal-label">Photo ${i + 1}${(DB.data.gallery || [])[i] ? " · custom" : " · default"}</span>
                <div class="row gap">
                  <label class="mini-btn" style="cursor:pointer">Change
                    <input type="file" accept="image/*" data-gal="${i}" hidden>
                  </label>
                  ${(DB.data.gallery || [])[i] ? `<button class="mini-btn danger" data-galreset="${i}">Reset</button>` : ""}
                </div>
              </div>`).join("")}
          </div>
        </div>
      </div>`;

    // payment info: numbers + QR uploads
    const qrThumb = (which) => {
      const img = document.getElementById(which === "gcash" ? "qrThumbGcash" : "qrThumbBank");
      const src = which === "gcash" ? DB.data.payment.gcashQr : DB.data.payment.bankQr;
      img.src = src || GALLERY_PLACEHOLDER;
    };
    qrThumb("gcash");
    qrThumb("bank");

    document.getElementById("payInfoForm").addEventListener("submit", (e) => {
      e.preventDefault();
      DB.data.payment.gcashNumber = document.getElementById("payGcashNum").value.trim();
      DB.data.payment.bankAccount = document.getElementById("payBankNum").value.trim();
      DB.save();
      toast("Payment numbers saved.", "success");
    });

    document.querySelectorAll("[data-qr]").forEach((inp) =>
      inp.addEventListener("change", async () => {
        const which = inp.dataset.qr;
        const file = inp.files[0];
        if (!file || !file.type.startsWith("image/")) return;
        try {
          const dataURL = await imageFileToDataURL(file, 700, 0.85);
          const key = which === "gcash" ? "gcashQr" : "bankQr";
          const prev = DB.data.payment[key];
          DB.data.payment[key] = dataURL;
          try {
            DB.save();
          } catch {
            DB.data.payment[key] = prev;
            return toast("Storage is full — try a smaller image.", "error");
          }
          toast(`${which === "gcash" ? "GCash" : "Bank"} QR uploaded — players will now see it at checkout.`, "success");
          this.render_settings();
        } catch {
          toast("Couldn't read that image file.", "error");
        }
      }));

    document.querySelectorAll("[data-qrreset]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const key = btn.dataset.qrreset === "gcash" ? "gcashQr" : "bankQr";
        DB.data.payment[key] = null;
        DB.save();
        toast("QR code removed.", "success");
        this.render_settings();
      }));

    document.getElementById("contactInfoForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const c = DB.data.contact;
      c.address = document.getElementById("ciAddress").value.trim();
      c.phone = document.getElementById("ciPhone").value.trim();
      c.email = document.getElementById("ciEmail").value.trim();
      c.socials = document.getElementById("ciSocials").value.trim();
      c.note = document.getElementById("ciNote").value.trim();
      DB.save();
      toast("Contact info saved — Contacts page and home page updated.", "success");
    });

    // gallery previews + handlers
    for (let i = 0; i < 10; i++) setGalleryImg(document.getElementById("galImg" + i), i);

    document.querySelectorAll("[data-gal]").forEach((inp) =>
      inp.addEventListener("change", async () => {
        const i = Number(inp.dataset.gal);
        const file = inp.files[0];
        if (!file || !file.type.startsWith("image/")) return;
        try {
          const dataURL = await imageFileToDataURL(file);
          if (!DB.data.gallery) DB.data.gallery = new Array(10).fill(null);
          const prev = DB.data.gallery[i];
          DB.data.gallery[i] = dataURL;
          try {
            DB.save();
          } catch {
            DB.data.gallery[i] = prev;
            return toast("Storage is full — try a smaller photo.", "error");
          }
          toast(`Photo ${i + 1} updated on the home page.`, "success");
          this.render_settings();
        } catch {
          toast("Couldn't read that image file.", "error");
        }
      }));

    document.querySelectorAll("[data-galreset]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.galreset);
        DB.data.gallery[i] = null;
        DB.save();
        toast(`Photo ${i + 1} reset to default (p${i + 1}.jpg).`, "success");
        this.render_settings();
      }));

    document.getElementById("hoursForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const open = Number(document.getElementById("sOpen").value);
      const close = Number(document.getElementById("sClose").value);
      if (close <= open) return toast("Closing time must be after opening time.", "error");
      s.openHour = open;
      s.closeHour = close;
      DB.save();
      toast("Operating hours saved.", "success");
    });

    document.getElementById("priceForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const price = Number(document.getElementById("sPrice").value);
      const disc = Number(document.getElementById("sDisc").value);
      if (disc > price) return toast("Discount cannot exceed the hourly rate.", "error");
      s.pricePerHour = price;
      s.discountAfterHours = Math.max(1, Number(document.getElementById("sAfter").value));
      s.discountPerHour = disc;
      s.paddleRentPerHour = Number(document.getElementById("sPaddle").value);
      DB.save();
      toast("Pricing saved — the Pricing page updates automatically.", "success");
    });

    document.getElementById("policyForm").addEventListener("submit", (e) => {
      e.preventDefault();
      s.cancelHours = Math.max(0, Number(document.getElementById("sCancel").value));
      DB.save();
      toast("Policy saved.", "success");
    });

    document.getElementById("wipeBtn").addEventListener("click", async () => {
      const ok = await confirmDialog("Reset ALL data?",
        "This permanently deletes every user, booking, and setting in this browser. You will be signed out.",
        "Erase everything");
      if (!ok) return;
      localStorage.removeItem(DB_KEY);
      DB.clearSession();
      location.href = "index.html";
    });
  },

  allHourOptions(selected) {
    let out = "";
    for (let h = 0; h <= 24; h++) {
      const label = h === 24 ? "12:00 AM (midnight)" : fmtHour(h);
      out += `<option value="${h}" ${h === selected ? "selected" : ""}>${label}</option>`;
    }
    return out;
  },

  bind() {
    document.querySelectorAll("[data-atab]").forEach((t) =>
      t.addEventListener("click", () => this.show(t.dataset.atab)));
  },
};

document.addEventListener("DOMContentLoaded", () => {
  if (!Shell.guard({ requireAuth: true, requireAdmin: true })) return;
  Shell.renderHeader();
  Shell.renderFooter();
  Admin.bind();
  Admin.show("overview");
});
