/* ============ Shared shell: toasts, confirm, header, guards, notifications ============ */

function toast(msg, type = "info") {
  const wrap = document.getElementById("toastWrap");
  if (!wrap) return alert(msg);
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .3s";
    setTimeout(() => el.remove(), 320);
  }, 3600);
}

function confirmDialog(title, msg, yesLabel = "Confirm") {
  return new Promise((resolve) => {
    const back = document.createElement("div");
    back.className = "modal-backdrop";
    back.innerHTML = `
      <div class="modal">
        <h3>${escapeHtml(title)}</h3>
        <p class="muted">${escapeHtml(msg)}</p>
        <div class="modal-actions">
          <button class="btn ghost" data-act="no">Cancel</button>
          <button class="btn danger" data-act="yes">${escapeHtml(yesLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(back);
    back.addEventListener("click", (e) => {
      const act = e.target.dataset && e.target.dataset.act;
      if (act || e.target === back) {
        back.remove();
        resolve(act === "yes");
      }
    });
  });
}

/* Fullscreen image viewer (payment proofs, QR codes) */
function showImageOverlay(src, alt = "image") {
  const box = document.createElement("div");
  box.className = "lightbox";
  box.innerHTML = `
    <button class="lb-close" title="Close">✕</button>
    <img src="${src}" alt="${escapeHtml(alt)}">`;
  document.body.appendChild(box);
  box.addEventListener("click", (e) => {
    if (e.target === box || e.target.classList.contains("lb-close")) box.remove();
  });
}

const Shell = {
  user: null,

  /* Restore session; redirect to sign-in when auth is required. */
  guard({ requireAuth = true, requireAdmin = false } = {}) {
    DB.load();
    const s = DB.getSession();
    if (s) {
      const u = DB.findUser(s.userId);
      if (u && u.active) this.user = u;
      else DB.clearSession();
    }
    if (requireAuth && !this.user) {
      location.href = "login.html";
      return false;
    }
    if (requireAdmin && (!this.user || this.user.role !== "admin")) {
      location.href = "book.html";
      return false;
    }
    return true;
  },

  /* Build the shared top bar into #siteHeader */
  renderHeader() {
    const mount = document.getElementById("siteHeader");
    if (!mount) return;
    const page = document.body.dataset.page;
    const u = this.user;

    const navLinks = [
      ["home", "index.html", "Home"],
      ["book", "book.html", "Book"],
      ["mybookings", "my-bookings.html", "My Bookings"],
      ["pricing", "pricing.html", "Pricing"],
      ["events", "events.html", "Events"],
      ["contacts", "contacts.html", "Contacts"],
    ];
    if (u && u.role === "admin") navLinks.push(["admin", "admin.html", "Admin"]);

    const nav = navLinks
      .map(([key, href, label]) =>
        `<a class="nav-link ${page === key ? "active" : ""}" href="${href}">${label}</a>`)
      .join("");

    const right = u
      ? `<button id="bellBtn" class="icon-btn" title="Notifications">🔔<span id="bellDot" class="bell-dot hidden"></span></button>
         <a class="user-chip" href="profile.html" title="My profile">
           <span class="avatar">${escapeHtml(this.initials(u.name))}</span>
           <span class="user-name">${escapeHtml(u.name.split(" ")[0])}</span>
         </a>
         <button id="logoutBtn" class="btn ghost small-btn">Sign out</button>`
      : `<a class="btn primary small-btn" href="login.html">Sign In</a>`;

    mount.innerHTML = `
      <header class="topbar">
        <a class="brand" href="index.html">
          <img src="Pickle Ball Logo.jpg" alt="J's Pickle Yard" class="brand-logo">
          <span class="brand-name">J'S <em>PICKLE YARD</em></span>
        </a>
        <nav class="mainnav">${nav}</nav>
        <div class="topbar-right">${right}</div>
      </header>
      <div id="notifDrawer" class="notif-drawer hidden">
        <div class="notif-head">
          <strong>Notifications</strong>
          <button id="notifMarkAll" class="link-btn">Mark all read</button>
        </div>
        <div id="notifList" class="notif-list"></div>
      </div>`;

    if (u) {
      document.getElementById("logoutBtn").addEventListener("click", () => {
        DB.clearSession();
        location.href = "login.html";
      });
      document.getElementById("bellBtn").addEventListener("click", () => {
        document.getElementById("notifDrawer").classList.toggle("hidden");
        this.renderNotifications();
      });
      document.getElementById("notifMarkAll").addEventListener("click", () => {
        DB.data.notifications.forEach((n) => { if (n.userId === u.id) n.read = true; });
        DB.save();
        this.renderNotifications();
      });
      document.addEventListener("click", (e) => {
        const drawer = document.getElementById("notifDrawer");
        if (!drawer.classList.contains("hidden") &&
            !drawer.contains(e.target) && e.target.id !== "bellBtn") {
          drawer.classList.add("hidden");
        }
      });
      this.updateBell();
    }

    const yr = document.getElementById("year");
    if (yr) yr.textContent = new Date().getFullYear();
  },

  initials(name) {
    return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
  },

  myNotifications() {
    return DB.data.notifications.filter((n) => n.userId === this.user.id);
  },

  updateBell() {
    const dot = document.getElementById("bellDot");
    if (!dot) return;
    const unread = this.myNotifications().some((n) => !n.read);
    dot.classList.toggle("hidden", !unread);
  },

  renderNotifications() {
    const list = document.getElementById("notifList");
    const items = this.myNotifications().slice(0, 30);
    if (!items.length) {
      list.innerHTML = `<div class="notif-empty">No notifications yet.</div>`;
    } else {
      list.innerHTML = items
        .map((n) => `
          <div class="notif-item ${n.read ? "" : "unread"}">
            ${escapeHtml(n.msg)}
            <span class="when">${timeAgo(n.at)}</span>
          </div>`)
        .join("");
      items.forEach((n) => (n.read = true));
      DB.save();
    }
    this.updateBell();
  },

  /* Standard footer */
  renderFooter() {
    const mount = document.getElementById("siteFooter");
    if (!mount) return;
    mount.innerHTML = `
      <footer class="footer">
        <span>© ${new Date().getFullYear()} J's Pickle Yard · Play • Connect • Compete</span>
      </footer>`;
  },
};
