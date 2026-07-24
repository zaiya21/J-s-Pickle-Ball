/* ============ Auth page (login.html) ============ */
const Auth = {
  pendingVerifyEmail: null,
  pendingResetEmail: null,

  panels: ["loginPanel", "registerPanel", "verifyPanel", "forgotPanel", "resetPanel"],

  showPanel(id) {
    this.panels.forEach((p) => document.getElementById(p).classList.toggle("hidden", p !== id));
  },

  validPassword(p) {
    return typeof p === "string" && p.length >= 8 && /[a-zA-Z]/.test(p) && /\d/.test(p);
  },

  /* Simulated email — shows the message in the Demo Inbox modal */
  sendEmail(to, subject, bodyHtml) {
    document.getElementById("inboxBody").innerHTML = `
      <div class="muted small">To: ${escapeHtml(to)}</div>
      <div style="font-weight:700;margin:.3rem 0 .5rem">${escapeHtml(subject)}</div>
      ${bodyHtml}`;
    document.getElementById("inboxModal").classList.remove("hidden");
  },

  async register(name, email, phone, pass, pass2) {
    name = name.trim();
    email = email.trim().toLowerCase();
    if (!name) return toast("Please enter your name.", "error");
    if (!this.validPassword(pass))
      return toast("Password must be at least 8 characters with letters and numbers.", "error");
    if (pass !== pass2) return toast("Passwords do not match.", "error");
    if (DB.findUserByEmail(email)) return toast("That email is already registered.", "error");

    const salt = randomSalt();
    const code = randomCode();
    DB.data.users.push({
      id: DB.nextId("u"),
      name, email, phone: phone.trim(),
      salt,
      passHash: await hashPassword(pass, salt),
      role: "user",
      verified: false,
      active: true,
      verifyCode: code,
      createdAt: Date.now(),
    });
    DB.save();

    this.pendingVerifyEmail = email;
    document.getElementById("verifyEmailLabel").textContent = email;
    this.showPanel("verifyPanel");
    this.sendEmail(email, "Verify your J's Pickle Yard account",
      `<p>Welcome to J's Pickle Yard! Your verification code is:</p>
       <div class="mail-code">${code}</div>
       <p class="muted small center">Enter this code on the verification screen.</p>`);
  },

  resendVerify() {
    const u = DB.findUserByEmail(this.pendingVerifyEmail);
    if (!u) return;
    u.verifyCode = randomCode();
    DB.save();
    this.sendEmail(u.email, "Your new verification code",
      `<div class="mail-code">${u.verifyCode}</div>`);
  },

  verify(code) {
    const u = DB.findUserByEmail(this.pendingVerifyEmail);
    if (!u) return toast("Session expired — please register again.", "error");
    if (String(code).trim() !== u.verifyCode)
      return toast("Incorrect code. Check the demo inbox and try again.", "error");
    u.verified = true;
    delete u.verifyCode;
    DB.save();
    DB.notify(u.id, "Welcome to J's Pickle Yard! Your email is verified — you can now book courts. 🎉", "success");
    toast("Email verified! You can now sign in.", "success");
    this.showPanel("loginPanel");
    document.getElementById("loginEmail").value = u.email;
  },

  async login(email, pass, remember) {
    const u = DB.findUserByEmail(email);
    const fail = () => toast("Invalid email or password.", "error");
    if (!u) return fail();

    // Simple lockout: 5 failed attempts → 60s cooldown
    const now = Date.now();
    if (u.lockUntil && now < u.lockUntil)
      return toast(`Too many attempts. Try again in ${Math.ceil((u.lockUntil - now) / 1000)}s.`, "warn");

    const hash = await hashPassword(pass, u.salt);
    if (hash !== u.passHash) {
      u.failedAttempts = (u.failedAttempts || 0) + 1;
      if (u.failedAttempts >= 5) {
        u.lockUntil = now + 60000;
        u.failedAttempts = 0;
      }
      DB.save();
      return fail();
    }
    if (!u.active) return toast("This account has been deactivated. Contact the admin.", "error");
    if (!u.verified) {
      this.pendingVerifyEmail = u.email;
      u.verifyCode = u.verifyCode || randomCode();
      DB.save();
      document.getElementById("verifyEmailLabel").textContent = u.email;
      this.showPanel("verifyPanel");
      this.sendEmail(u.email, "Verify your account to continue",
        `<div class="mail-code">${u.verifyCode}</div>`);
      return toast("Please verify your email first.", "warn");
    }

    u.failedAttempts = 0;
    delete u.lockUntil;
    u.lastLogin = Date.now();
    DB.save();
    DB.setSession(u.id, remember);
    location.href = "index.html";
  },

  forgot(email) {
    const u = DB.findUserByEmail(email);
    // Never reveal whether the email exists
    this.pendingResetEmail = email.trim().toLowerCase();
    if (u) {
      u.resetCode = randomCode();
      u.resetExpires = Date.now() + 15 * 60 * 1000;
      DB.save();
      this.sendEmail(u.email, "Password reset code",
        `<p>Use this code to reset your password (valid 15 minutes):</p>
         <div class="mail-code">${u.resetCode}</div>`);
    } else {
      this.sendEmail(this.pendingResetEmail, "Password reset requested",
        `<p class="muted">If an account exists for this address, a reset code was issued.
         <em>(No account found — this notice keeps account existence private.)</em></p>`);
    }
    document.getElementById("resetEmailLabel").textContent = this.pendingResetEmail;
    this.showPanel("resetPanel");
  },

  async reset(code, pass) {
    const u = DB.findUserByEmail(this.pendingResetEmail);
    if (!u || !u.resetCode) return toast("Invalid or expired reset request.", "error");
    if (Date.now() > u.resetExpires) return toast("Reset code expired. Request a new one.", "error");
    if (String(code).trim() !== u.resetCode) return toast("Incorrect reset code.", "error");
    if (!this.validPassword(pass))
      return toast("Password must be at least 8 characters with letters and numbers.", "error");

    u.salt = randomSalt();
    u.passHash = await hashPassword(pass, u.salt);
    delete u.resetCode;
    delete u.resetExpires;
    DB.save();
    DB.notify(u.id, "Your password was changed. If this wasn't you, contact support immediately.", "warn");
    toast("Password updated — sign in with your new password.", "success");
    this.showPanel("loginPanel");
    document.getElementById("loginEmail").value = u.email;
  },

  bind() {
    const $ = (id) => document.getElementById(id);

    $("toRegister").addEventListener("click", (e) => { e.preventDefault(); this.showPanel("registerPanel"); });
    $("toLogin").addEventListener("click", (e) => { e.preventDefault(); this.showPanel("loginPanel"); });
    $("toForgot").addEventListener("click", (e) => { e.preventDefault(); this.showPanel("forgotPanel"); });
    ["verifyBack", "forgotBack", "resetBack"].forEach((id) =>
      $(id).addEventListener("click", (e) => { e.preventDefault(); this.showPanel("loginPanel"); }));
    $("resendCode").addEventListener("click", (e) => { e.preventDefault(); this.resendVerify(); });

    document.querySelectorAll(".pw-toggle").forEach((btn) =>
      btn.addEventListener("click", () => {
        const inp = $(btn.dataset.for);
        inp.type = inp.type === "password" ? "text" : "password";
      }));

    // password strength meter
    $("regPassword").addEventListener("input", (e) => {
      const v = e.target.value;
      let score = 0;
      if (v.length >= 8) score++;
      if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
      if (/\d/.test(v)) score++;
      if (/[^a-zA-Z0-9]/.test(v)) score++;
      const bar = document.querySelector("#pwMeter span");
      const widths = ["8%", "30%", "55%", "80%", "100%"];
      const colors = ["#f87171", "#f87171", "#fbbf24", "#a855f7", "#34d399"];
      bar.style.width = widths[score];
      bar.style.background = colors[score];
    });

    $("loginPanel").addEventListener("submit", (e) => {
      e.preventDefault();
      this.login($("loginEmail").value, $("loginPassword").value, $("rememberMe").checked);
    });
    $("registerPanel").addEventListener("submit", (e) => {
      e.preventDefault();
      this.register($("regName").value, $("regEmail").value, $("regPhone").value,
        $("regPassword").value, $("regPassword2").value);
    });
    $("verifyPanel").addEventListener("submit", (e) => {
      e.preventDefault();
      this.verify($("verifyCode").value);
    });
    $("forgotPanel").addEventListener("submit", (e) => {
      e.preventDefault();
      this.forgot($("forgotEmail").value);
    });
    $("resetPanel").addEventListener("submit", (e) => {
      e.preventDefault();
      this.reset($("resetCode").value, $("resetPassword").value);
    });

    $("inboxClose").addEventListener("click", () => $("inboxModal").classList.add("hidden"));
  },
};

document.addEventListener("DOMContentLoaded", async () => {
  await seedDB();
  // Already signed in? Go to the home page.
  const s = DB.getSession();
  if (s && DB.findUser(s.userId) && DB.findUser(s.userId).active) {
    location.href = "index.html";
    return;
  }
  Auth.bind();
});
