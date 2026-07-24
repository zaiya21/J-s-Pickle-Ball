/* ============ Booking page (book.html) ============ */
const Booking = {
  courtId: null,
  date: todayStr(),
  selected: [],   // selected hours (must stay consecutive)
  paddles: 0,

  activeCourts() {
    return DB.data.courts.filter((c) => c.active);
  },

  init() {
    const s = DB.data.settings;
    document.getElementById("hoursLabel").textContent =
      `${fmtHour(s.openHour)} – ${fmtHour(s.closeHour)}`;
    this.courtId = (this.activeCourts()[0] || {}).id || null;
    this.renderCourts();
    this.renderDates();
    this.renderSlots();
    this.bind();
  },

  renderCourts() {
    const wrap = document.getElementById("courtTabs");
    wrap.innerHTML = this.activeCourts()
      .map((c) => `<button class="court-tab ${c.id === this.courtId ? "active" : ""}" data-court="${c.id}">${escapeHtml(c.name)}</button>`)
      .join("") || `<span class="muted">No courts are currently open.</span>`;
    wrap.querySelectorAll(".court-tab").forEach((b) =>
      b.addEventListener("click", () => {
        this.courtId = b.dataset.court;
        this.selected = [];
        this.renderCourts();
        this.renderSlots();
      }));
    this.renderCourtPhoto();
  },

  renderCourtPhoto() {
    const wrapEl = document.getElementById("courtPhotoWrap");
    if (!this.courtId) { wrapEl.classList.add("hidden"); return; }
    wrapEl.classList.remove("hidden");
    setCourtImg(document.getElementById("courtPhoto"), this.courtId);
    const court = DB.data.courts.find((c) => c.id === this.courtId);
    document.getElementById("courtPhotoName").textContent = court ? court.name : "";
  },

  renderDates() {
    const wrap = document.getElementById("dateStrip");
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    wrap.innerHTML = days
      .map((d) => {
        const str = dateToStr(d);
        return `<button class="date-chip ${str === this.date ? "active" : ""}" data-date="${str}">
          <span class="dow">${d.toLocaleDateString(undefined, { weekday: "short" })}</span>
          <span class="dom">${d.getDate()}</span>
          <span class="mon">${d.toLocaleDateString(undefined, { month: "short" })}</span>
        </button>`;
      })
      .join("");
    wrap.querySelectorAll(".date-chip").forEach((b) =>
      b.addEventListener("click", () => {
        this.date = b.dataset.date;
        this.selected = [];
        this.renderDates();
        this.renderSlots();
      }));
  },

  slotState(hour) {
    const now = new Date();
    const isToday = this.date === todayStr();
    if (this.date < todayStr() || (isToday && hour <= now.getHours())) return { cls: "past", label: "Past" };
    const maint = DB.maintenanceAt(this.date, this.courtId, hour);
    if (maint) return { cls: "maint", label: "Maintenance" };
    const bk = DB.isSlotBooked(this.date, this.courtId, hour);
    if (bk) {
      return bk.userId === Shell.user.id
        ? { cls: "mine", label: "Your booking" }
        : { cls: "booked", label: "Booked" };
    }
    if (this.selected.includes(hour)) return { cls: "selected", label: "Selected" };
    return { cls: "available", label: "Available" };
  },

  renderSlots() {
    const s = DB.data.settings;
    const grid = document.getElementById("slotGrid");
    if (!this.courtId) { grid.innerHTML = ""; return; }
    let html = "";
    for (let h = s.openHour; h < s.closeHour; h++) {
      const st = this.slotState(h);
      html += `
        <div class="slot ${st.cls}" data-hour="${h}">
          <div class="slot-time">${fmtHour(h)} – ${fmtHour(h + 1)}</div>
          <div class="slot-state"><span>${st.label}</span></div>
        </div>`;
    }
    grid.innerHTML = html;
    grid.querySelectorAll(".slot.available, .slot.selected").forEach((el) =>
      el.addEventListener("click", () => this.toggleSlot(Number(el.dataset.hour))));
    this.renderSummary();
  },

  toggleSlot(hour) {
    const i = this.selected.indexOf(hour);
    if (i >= 0) {
      this.selected.splice(i, 1);
      // keep the selection consecutive: drop the shorter side if a gap appears
      this.selected.sort((a, b) => a - b);
      for (let k = 1; k < this.selected.length; k++) {
        if (this.selected[k] !== this.selected[k - 1] + 1) {
          this.selected = hour - this.selected[0] <= this.selected[this.selected.length - 1] - hour
            ? this.selected.slice(k)
            : this.selected.slice(0, k);
          break;
        }
      }
    } else {
      if (this.selected.length &&
          hour !== Math.min(...this.selected) - 1 &&
          hour !== Math.max(...this.selected) + 1) {
        this.selected = [hour]; // non-adjacent click starts a new selection
      } else {
        this.selected.push(hour);
      }
    }
    this.renderSlots();
  },

  renderSummary() {
    const bar = document.getElementById("bookSummary");
    if (!this.selected.length) { bar.classList.add("hidden"); return; }
    bar.classList.remove("hidden");
    const from = Math.min(...this.selected);
    const to = Math.max(...this.selected) + 1;
    const hours = this.selected.length;
    const court = DB.data.courts.find((c) => c.id === this.courtId);
    document.getElementById("summaryText").textContent =
      `${court.name} · ${fmtDateLong(this.date)} · ${fmtHour(from)} – ${fmtHour(to)} (${hours} hr${hours > 1 ? "s" : ""})`;
    document.getElementById("summaryPrice").textContent =
      `${fmtMoney(calcCourtCost(hours))} court fee` +
      (hours > DB.data.settings.discountAfterHours ? " · multi-hour discount applied ✓" : "");
  },

  /* ---- payment ---- */
  openPayment() {
    this.paddles = 0;
    document.getElementById("paddleRateLabel").textContent = DB.data.settings.paddleRentPerHour;
    this.renderPayDetails();
    document.getElementById("payModal").classList.remove("hidden");
  },

  renderPayDetails() {
    const s = DB.data.settings;
    const hours = this.selected.length;
    const from = Math.min(...this.selected);
    const to = Math.max(...this.selected) + 1;
    const court = DB.data.courts.find((c) => c.id === this.courtId);
    const fullHrs = Math.min(hours, s.discountAfterHours);
    const extraHrs = Math.max(0, hours - s.discountAfterHours);
    const paddleCost = calcPaddleCost(this.paddles, hours);

    let rows = `
      <div class="pd-row"><span>Court</span><span>${escapeHtml(court.name)}</span></div>
      <div class="pd-row"><span>Date</span><span>${fmtDateLong(this.date)}</span></div>
      <div class="pd-row"><span>Time</span><span>${fmtHour(from)} – ${fmtHour(to)}</span></div>
      <div class="pd-row"><span>Court fee (${fullHrs} hr × ${fmtMoney(s.pricePerHour)})</span><span>${fmtMoney(fullHrs * s.pricePerHour)}</span></div>`;
    if (extraHrs > 0) {
      rows += `<div class="pd-row"><span>Discounted hours (${extraHrs} hr × ${fmtMoney(s.pricePerHour - s.discountPerHour)})</span><span>${fmtMoney(extraHrs * (s.pricePerHour - s.discountPerHour))}</span></div>`;
    }
    if (this.paddles > 0) {
      rows += `<div class="pd-row"><span>Paddle rental (${this.paddles} × ${hours} hr × ${fmtMoney(s.paddleRentPerHour)})</span><span>${fmtMoney(paddleCost)}</span></div>`;
    }
    rows += `<div class="pd-row total"><span>Total</span><span>${fmtMoney(calcTotal(hours, this.paddles))}</span></div>`;
    document.getElementById("payDetails").innerHTML = rows;
    document.getElementById("paddleQty").textContent = this.paddles;
  },

  confirmBooking() {
    const hours = this.selected.length;
    const from = Math.min(...this.selected);
    const to = Math.max(...this.selected) + 1;

    // Re-check availability right before saving (prevents double booking)
    DB.load();
    for (let h = from; h < to; h++) {
      if (DB.isSlotBooked(this.date, this.courtId, h) || DB.maintenanceAt(this.date, this.courtId, h)) {
        document.getElementById("payModal").classList.add("hidden");
        this.selected = [];
        this.renderSlots();
        return toast("Sorry — one of those slots was just taken. Please pick again.", "error");
      }
    }

    const method = document.querySelector('input[name="payMethod"]:checked').value;
    const court = DB.data.courts.find((c) => c.id === this.courtId);
    // GCash/Bank are verified manually: admin marks paid after checking the proof of payment
    const payStatus = method === "Pay at venue" ? "unpaid" : "pending";
    const booking = {
      id: DB.nextId("b"),
      ref: "JPY-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      userId: Shell.user.id,
      courtId: this.courtId,
      date: this.date,
      start: from,
      end: to,
      paddles: this.paddles,
      amount: calcTotal(hours, this.paddles),
      payMethod: method,
      payStatus,
      status: "confirmed",
      createdAt: Date.now(),
    };
    DB.data.bookings.push(booking);
    DB.save();
    DB.notify(Shell.user.id,
      `Booking confirmed: ${court.name}, ${fmtDateLong(this.date)} ${fmtHour(from)}–${fmtHour(to)} (Ref ${booking.ref}).`,
      "success");
    DB.notifyAdmins(`New booking by ${Shell.user.name}: ${court.name}, ${fmtDateLong(this.date)} ${fmtHour(from)}–${fmtHour(to)}.`);

    document.getElementById("payModal").classList.add("hidden");
    document.getElementById("receiptBody").innerHTML = `
      <div class="pd-row"><span>Reference</span><strong>${booking.ref}</strong></div>
      <div class="pd-row"><span>Court</span><span>${escapeHtml(court.name)}</span></div>
      <div class="pd-row"><span>Date</span><span>${fmtDateLong(booking.date)}</span></div>
      <div class="pd-row"><span>Time</span><span>${fmtHour(from)} – ${fmtHour(to)}</span></div>
      ${booking.paddles ? `<div class="pd-row"><span>Paddles</span><span>${booking.paddles}</span></div>` : ""}
      <div class="pd-row"><span>Payment</span><span>${booking.payMethod} · ${booking.payStatus}</span></div>
      <div class="pd-row total"><span>Total</span><strong>${fmtMoney(booking.amount)}</strong></div>
      ${payStatus === "pending"
        ? `<p class="muted small center" style="margin-top:.6rem">⚠ Please upload your proof of payment in <strong>My Bookings</strong> so we can verify it.</p>`
        : ""}`;
    document.getElementById("receiptModal").classList.remove("hidden");

    this.selected = [];
    this.paddles = 0;
    this.renderSlots();
    Shell.updateBell();
  },

  /* ---- payment QR popup ---- */
  showQr(method) {
    const p = DB.data.payment;
    const isGcash = method === "GCash";
    const qr = isGcash ? p.gcashQr : p.bankQr;
    const num = isGcash ? p.gcashNumber : p.bankAccount;

    document.getElementById("qrTitle").textContent = isGcash ? "Pay via GCash" : "Pay via Bank Transfer";
    document.getElementById("qrNumber").textContent = num
      ? (isGcash ? `GCash No: ${num}` : `Account No: ${num}`)
      : "Payment details not set up yet — please contact us or pay at the venue.";

    const img = document.getElementById("qrImg");
    const noImg = document.getElementById("qrNoImg");
    const dl = document.getElementById("qrDownload");
    if (qr) {
      img.src = qr;
      img.classList.remove("hidden");
      noImg.classList.add("hidden");
      dl.href = qr;
      dl.download = (isGcash ? "gcash" : "bank") + "-qr.png";
      dl.classList.remove("hidden");
    } else {
      img.classList.add("hidden");
      noImg.classList.remove("hidden");
      dl.classList.add("hidden");
    }
    document.getElementById("qrModal").classList.remove("hidden");
  },

  bind() {
    document.getElementById("clearSelection").addEventListener("click", () => {
      this.selected = [];
      this.renderSlots();
    });
    document.getElementById("proceedBooking").addEventListener("click", () => {
      if (!this.selected.length) return;
      this.openPayment();
    });
    document.getElementById("payCancel").addEventListener("click", () =>
      document.getElementById("payModal").classList.add("hidden"));
    document.getElementById("payConfirm").addEventListener("click", () => this.confirmBooking());
    document.getElementById("receiptClose").addEventListener("click", () =>
      document.getElementById("receiptModal").classList.add("hidden"));
    document.getElementById("paddlePlus").addEventListener("click", () => {
      if (this.paddles < 8) { this.paddles++; this.renderPayDetails(); }
    });
    document.getElementById("paddleMinus").addEventListener("click", () => {
      if (this.paddles > 0) { this.paddles--; this.renderPayDetails(); }
    });
    // choosing GCash / Bank Transfer pops up the QR code
    document.querySelectorAll('input[name="payMethod"]').forEach((r) =>
      r.addEventListener("change", () => {
        if (r.checked && (r.value === "GCash" || r.value === "Bank Transfer")) this.showQr(r.value);
      }));
    document.getElementById("qrClose").addEventListener("click", () =>
      document.getElementById("qrModal").classList.add("hidden"));
  },
};

document.addEventListener("DOMContentLoaded", () => {
  if (!Shell.guard({ requireAuth: true })) return;
  Shell.renderHeader();
  Shell.renderFooter();
  Booking.init();
});
