/* ============ Tournaments & Events page (events.html) ============ */
const Events = {
  editingId: null,
  photos: [],          // data URLs currently in the form (max 5)
  MAX_PHOTOS: 5,

  isAdmin() {
    return Shell.user && Shell.user.role === "admin";
  },

  /* Downscale + compress an image file so 5 photos fit in localStorage */
  fileToDataURL(file, maxW = 900, quality = 0.78) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
      img.src = url;
    });
  },

  async addPhotos(files) {
    for (const f of files) {
      if (this.photos.length >= this.MAX_PHOTOS) {
        toast(`Maximum of ${this.MAX_PHOTOS} photos per event.`, "warn");
        break;
      }
      if (!f.type.startsWith("image/")) continue;
      try {
        this.photos.push(await this.fileToDataURL(f));
      } catch {
        toast(`Couldn't read "${f.name}" — skipped.`, "error");
      }
    }
    this.renderPreviews();
  },

  renderPreviews() {
    document.getElementById("photoCount").textContent = this.photos.length;
    document.getElementById("uploadPreviews").innerHTML = this.photos
      .map((p, i) => `
        <div class="upload-thumb">
          <img src="${p}" alt="Photo ${i + 1}">
          <button type="button" class="rm" data-rm="${i}" title="Remove">✕</button>
        </div>`)
      .join("");
    document.querySelectorAll("[data-rm]").forEach((b) =>
      b.addEventListener("click", () => {
        this.photos.splice(Number(b.dataset.rm), 1);
        this.renderPreviews();
      }));
  },

  resetForm() {
    this.editingId = null;
    this.photos = [];
    document.getElementById("eventForm").reset();
    document.getElementById("eventFormTitle").textContent = "Post an event";
    document.getElementById("evSubmit").textContent = "Post Event";
    document.getElementById("evCancelEdit").classList.add("hidden");
    this.renderPreviews();
  },

  startEdit(id) {
    const ev = DB.data.events.find((e) => e.id === id);
    if (!ev) return;
    this.editingId = id;
    this.photos = ev.photos.slice();
    document.getElementById("evTitle").value = ev.title;
    document.getElementById("evDate").value = ev.date;
    document.getElementById("evTime").value = ev.time || "";
    document.getElementById("evDesc").value = ev.desc;
    document.getElementById("eventFormTitle").textContent = "Edit event";
    document.getElementById("evSubmit").textContent = "Save Changes";
    document.getElementById("evCancelEdit").classList.remove("hidden");
    this.renderPreviews();
    document.getElementById("eventFormCard").scrollIntoView({ behavior: "smooth" });
  },

  save() {
    const title = document.getElementById("evTitle").value.trim();
    const date = document.getElementById("evDate").value;
    const time = document.getElementById("evTime").value.trim();
    const desc = document.getElementById("evDesc").value.trim();
    if (!title || !date || !desc) return toast("Title, date, and details are required.", "error");

    const isNew = !this.editingId;
    let ev;
    if (isNew) {
      ev = { id: DB.nextId("e"), createdAt: Date.now() };
      DB.data.events.push(ev);
    } else {
      ev = DB.data.events.find((e) => e.id === this.editingId);
      if (!ev) return;
    }
    const before = { ...ev };
    Object.assign(ev, { title, date, time, desc, photos: this.photos.slice() });

    try {
      DB.save();
    } catch (err) {
      // localStorage quota exceeded — roll back
      if (isNew) DB.data.events = DB.data.events.filter((e) => e.id !== ev.id);
      else Object.assign(ev, before);
      return toast("Storage is full — use fewer or smaller photos.", "error");
    }

    if (isNew) {
      // let every member know
      DB.data.users
        .filter((u) => u.role === "user" && u.active)
        .forEach((u) => DB.notify(u.id, `📣 New event: ${title} on ${fmtDateLong(date)} — check the Events page!`));
      toast("Event posted!", "success");
    } else {
      toast("Event updated.", "success");
    }
    this.resetForm();
    this.renderList();
  },

  async remove(id) {
    const ev = DB.data.events.find((e) => e.id === id);
    const ok = await confirmDialog("Delete event?",
      `"${ev.title}" and its photos will be permanently removed.`, "Delete");
    if (!ok) return;
    DB.data.events = DB.data.events.filter((e) => e.id !== id);
    DB.save();
    if (this.editingId === id) this.resetForm();
    this.renderList();
    toast("Event deleted.", "success");
  },

  eventCard(ev, isPast) {
    const admin = this.isAdmin();
    return `
      <div class="card event-card ${isPast ? "past-event" : ""}">
        <div class="event-top">
          <div>
            <div class="event-title">${escapeHtml(ev.title)}</div>
            <div class="event-when">📅 ${fmtDateLong(ev.date)}${ev.time ? ` · 🕗 ${escapeHtml(ev.time)}` : ""}
              ${isPast ? `<span class="badge completed" style="margin-left:.4rem">done</span>` : `<span class="badge confirmed" style="margin-left:.4rem">upcoming</span>`}
            </div>
          </div>
          ${admin ? `
            <div class="row gap">
              <button class="mini-btn" data-edit="${ev.id}">Edit</button>
              <button class="mini-btn danger" data-del="${ev.id}">Delete</button>
            </div>` : ""}
        </div>
        <p class="event-desc">${escapeHtml(ev.desc)}</p>
        ${ev.photos && ev.photos.length ? `
          <div class="event-photos">
            ${ev.photos.map((p, i) =>
              `<img src="${p}" alt="${escapeHtml(ev.title)} photo ${i + 1}" data-lb="${ev.id}" data-idx="${i}">`).join("")}
          </div>` : ""}
      </div>`;
  },

  renderList() {
    const list = document.getElementById("eventList");
    const today = todayStr();
    const events = DB.data.events || [];
    const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const past = events.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));

    if (!events.length) {
      list.innerHTML = `<div class="empty-state">No events posted yet — watch this space for tournaments, clinics, and open-play nights! 🏆</div>`;
      return;
    }

    let html = "";
    if (upcoming.length) {
      html += `<div class="event-divider">Upcoming</div>`;
      html += upcoming.map((e) => this.eventCard(e, false)).join("");
    }
    if (past.length) {
      html += `<div class="event-divider">Past events</div>`;
      html += past.map((e) => this.eventCard(e, true)).join("");
    }
    list.innerHTML = html;

    document.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => this.startEdit(b.dataset.edit)));
    document.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => this.remove(b.dataset.del)));
    document.querySelectorAll("[data-lb]").forEach((img) =>
      img.addEventListener("click", () =>
        this.openLightbox(img.dataset.lb, Number(img.dataset.idx))));
  },

  /* ---- lightbox ---- */
  openLightbox(eventId, idx) {
    const ev = DB.data.events.find((e) => e.id === eventId);
    if (!ev || !ev.photos.length) return;
    let i = idx;
    const box = document.createElement("div");
    box.className = "lightbox";
    const render = () => {
      box.innerHTML = `
        <button class="lb-close" title="Close">✕</button>
        ${ev.photos.length > 1 ? `<button class="lb-nav lb-prev" title="Previous">‹</button>` : ""}
        <img src="${ev.photos[i]}" alt="${escapeHtml(ev.title)} photo ${i + 1} of ${ev.photos.length}">
        ${ev.photos.length > 1 ? `<button class="lb-nav lb-next" title="Next">›</button>` : ""}`;
    };
    render();
    document.body.appendChild(box);
    box.addEventListener("click", (e) => {
      if (e.target.classList.contains("lb-prev")) {
        i = (i - 1 + ev.photos.length) % ev.photos.length; render();
      } else if (e.target.classList.contains("lb-next")) {
        i = (i + 1) % ev.photos.length; render();
      } else if (e.target.classList.contains("lb-close") || e.target === box) {
        box.remove();
      }
    });
  },

  bind() {
    if (this.isAdmin()) {
      document.getElementById("eventFormCard").classList.remove("hidden");
      document.getElementById("eventForm").addEventListener("submit", (e) => {
        e.preventDefault();
        this.save();
      });
      document.getElementById("evPhotos").addEventListener("change", (e) => {
        this.addPhotos(Array.from(e.target.files));
        e.target.value = "";   // allow re-picking the same file
      });
      document.getElementById("evCancelEdit").addEventListener("click", () => this.resetForm());
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  Shell.guard({ requireAuth: false });   // events are public to view; editing is admin-only
  Shell.renderHeader();
  Shell.renderFooter();
  Events.bind();
  Events.renderList();
});
