/* ============ My Bookings page (my-bookings.html) ============ */
const MyBookings = {
  tab: "upcoming",

  isUpcoming(b) {
    if (b.status !== "confirmed") return false;
    const end = new Date(b.date + "T00:00:00");
    end.setHours(b.end);
    return end > new Date();
  },

  myList() {
    const key = (b) => b.date + String(b.start).padStart(2, "0");
    return DB.data.bookings
      .filter((b) => b.userId === Shell.user.id)
      .sort((a, b) => key(b).localeCompare(key(a)));
  },

  canCancel(b) {
    if (b.status !== "confirmed") return false;
    const start = new Date(b.date + "T00:00:00");
    start.setHours(b.start);
    return start.getTime() - Date.now() > DB.data.settings.cancelHours * 3600 * 1000;
  },

  courtName(id) {
    const c = DB.data.courts.find((c) => c.id === id);
    return c ? c.name : "Court";
  },

  statusOf(b) {
    if (b.status === "cancelled") return "cancelled";
    return this.isUpcoming(b) ? "confirmed" : "completed";
  },

  render() {
    const list = document.getElementById("myBookingsList");
    const items = this.myList().filter((b) =>
      this.tab === "upcoming" ? this.isUpcoming(b) : !this.isUpcoming(b));

    if (!items.length) {
      list.innerHTML = `
        <div class="empty-state">
          ${this.tab === "upcoming"
            ? `No upcoming bookings.<br><a class="link" href="book.html">Book a court now →</a>`
            : `No booking history yet.`}
        </div>`;
      return;
    }

    // upcoming: soonest first; history: latest first
    if (this.tab === "upcoming") items.reverse();

    list.innerHTML = items.map((b) => {
      const st = this.statusOf(b);
      return `
      <div class="booking-card">
        <div>
          <div class="b-date">${fmtDateLong(b.date)} · ${fmtHour(b.start)} – ${fmtHour(b.end)}</div>
          <div class="b-meta">
            ${escapeHtml(this.courtName(b.courtId))} · Ref ${b.ref}
            ${b.paddles ? ` · 🏓 ${b.paddles} paddle${b.paddles > 1 ? "s" : ""}` : ""}
            · ${b.payMethod} (${b.payStatus})
          </div>
        </div>
        <div class="row gap">
          <span class="badge ${st}">${st}</span>
          ${b.payStatus === "pending" ? `<span class="badge pending">awaiting verification</span>` : ""}
          <strong class="price">${fmtMoney(b.amount)}</strong>
          ${b.proof ? `<button class="mini-btn" data-viewproof="${b.id}">View proof</button>` : ""}
          ${b.status === "confirmed" && (b.payStatus === "pending" || b.payStatus === "unpaid")
            ? `<label class="mini-btn" style="cursor:pointer">${b.proof ? "Re-upload proof" : "Upload proof of payment"}
                 <input type="file" accept="image/*" hidden data-proof="${b.id}">
               </label>`
            : ""}
          ${this.canCancel(b) && this.tab === "upcoming"
            ? `<button class="mini-btn danger" data-cancel="${b.id}">Cancel</button>`
            : ""}
        </div>
      </div>`;
    }).join("");

    list.querySelectorAll("[data-cancel]").forEach((btn) =>
      btn.addEventListener("click", () => this.cancel(btn.dataset.cancel)));

    list.querySelectorAll("[data-viewproof]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const b = DB.data.bookings.find((x) => x.id === btn.dataset.viewproof);
        if (b && b.proof) showImageOverlay(b.proof, "Proof of payment " + b.ref);
      }));

    list.querySelectorAll("[data-proof]").forEach((inp) =>
      inp.addEventListener("change", async () => {
        const b = DB.data.bookings.find((x) => x.id === inp.dataset.proof);
        const file = inp.files[0];
        if (!b || !file || !file.type.startsWith("image/")) return;
        try {
          const dataURL = await imageFileToDataURL(file, 1100, 0.8);
          const prev = b.proof;
          b.proof = dataURL;
          b.proofAt = Date.now();
          try {
            DB.save();
          } catch {
            b.proof = prev;
            return toast("Storage is full — try a smaller screenshot.", "error");
          }
          DB.notifyAdmins(`📎 ${Shell.user.name} uploaded proof of payment for booking ${b.ref} (${fmtMoney(b.amount)} via ${b.payMethod}).`);
          toast("Proof of payment submitted — we'll verify it shortly!", "success");
          this.render();
        } catch {
          toast("Couldn't read that image file.", "error");
        }
      }));
  },

  async cancel(id) {
    const b = DB.data.bookings.find((x) => x.id === id);
    if (!b) return;
    if (!this.canCancel(b))
      return toast(`Too late to cancel — the ${DB.data.settings.cancelHours}-hour policy applies.`, "warn");
    const ok = await confirmDialog(
      "Cancel booking?",
      `${this.courtName(b.courtId)} on ${fmtDateLong(b.date)}, ${fmtHour(b.start)}–${fmtHour(b.end)}. ` +
      (b.payStatus === "paid" ? "Your payment will be refunded (simulated)." : ""),
      "Cancel booking");
    if (!ok) return;

    b.status = "cancelled";
    b.cancelledAt = Date.now();
    if (b.payStatus === "paid") b.payStatus = "refunded";
    DB.save();
    DB.notify(Shell.user.id,
      `Booking ${b.ref} on ${fmtDateLong(b.date)} was cancelled.${b.payStatus === "refunded" ? " Refund issued." : ""}`,
      "warn");
    DB.notifyAdmins(`${Shell.user.name} cancelled booking ${b.ref} (${fmtDateLong(b.date)} ${fmtHour(b.start)}–${fmtHour(b.end)}).`);
    toast("Booking cancelled.", "success");
    this.render();
    Shell.updateBell();
  },

  bind() {
    document.querySelectorAll("[data-btab]").forEach((t) =>
      t.addEventListener("click", () => {
        document.querySelectorAll("[data-btab]").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        this.tab = t.dataset.btab;
        this.render();
      }));
  },
};

document.addEventListener("DOMContentLoaded", () => {
  if (!Shell.guard({ requireAuth: true })) return;
  Shell.renderHeader();
  Shell.renderFooter();
  document.getElementById("cancelPolicyLabel").textContent =
    DB.data.settings.cancelHours + " hours";
  MyBookings.bind();
  MyBookings.render();
});
