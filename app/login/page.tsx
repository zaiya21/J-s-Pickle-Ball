"use client";
/* Sign-in page — ported from login.html + js/auth.js, rewired to real Supabase
   Auth. Same auth-view/auth-card/auth-panel markup and classes. The old
   simulated "Demo Inbox" is gone because Supabase sends real emails; the verify
   panel now points the user to their inbox. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { validPassword } from "@/lib/helpers";
import { SUPABASE_CONFIGURED, NOT_CONFIGURED_MSG } from "@/lib/supabaseConfig";

type Panel = "login" | "register" | "verify" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [panel, setPanel] = useState<Panel>("login");
  const [pendingEmail, setPendingEmail] = useState("");
  const [busy, setBusy] = useState(false);

  // login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [remember, setRemember] = useState(false);

  // register fields
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");
  const [showRegPw, setShowRegPw] = useState(false);

  // forgot
  const [forgotEmail, setForgotEmail] = useState("");

  // Already signed in? Go home (mirrors js/auth.js DOMContentLoaded check).
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      toast(NOT_CONFIGURED_MSG, "warn");
      return;
    }
    if (new URLSearchParams(window.location.search).get("error") === "auth") {
      toast("That confirmation link is invalid or has expired — please try again.", "error");
    }
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace("/");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const strength = (() => {
    const v = regPassword;
    let score = 0;
    if (v.length >= 8) score++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
    if (/\d/.test(v)) score++;
    if (/[^a-zA-Z0-9]/.test(v)) score++;
    const widths = ["8%", "30%", "55%", "80%", "100%"];
    const colors = ["#f87171", "#f87171", "#fbbf24", "#a855f7", "#34d399"];
    return { width: widths[score], background: colors[score] };
  })();

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!SUPABASE_CONFIGURED) return toast(NOT_CONFIGURED_MSG, "error");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim().toLowerCase(),
      password: loginPassword,
    });
    setBusy(false);
    if (error) {
      if (/confirm/i.test(error.message)) {
        setPendingEmail(loginEmail.trim().toLowerCase());
        setPanel("verify");
        return toast("Please verify your email first — check your inbox.", "warn");
      }
      return toast("Invalid email or password.", "error");
    }
    router.push("/");
    router.refresh();
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!SUPABASE_CONFIGURED) return toast(NOT_CONFIGURED_MSG, "error");
    const name = regName.trim();
    const email = regEmail.trim().toLowerCase();
    if (!name) return toast("Please enter your name.", "error");
    if (!validPassword(regPassword))
      return toast("Password must be at least 8 characters with letters and numbers.", "error");
    if (regPassword !== regPassword2) return toast("Passwords do not match.", "error");

    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password: regPassword,
      options: {
        data: { name, phone: regPhone.trim() },
        emailRedirectTo: `${location.origin}/auth/callback?next=/login`,
      },
    });
    setBusy(false);
    if (error) {
      if (/registered|already/i.test(error.message))
        return toast("That email is already registered.", "error");
      return toast(error.message, "error");
    }
    setPendingEmail(email);
    setPanel("verify");
  }

  async function resendConfirm() {
    if (!pendingEmail) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=/login` },
    });
    toast(error ? error.message : "Confirmation email resent.", error ? "error" : "success");
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!SUPABASE_CONFIGURED) return toast(NOT_CONFIGURED_MSG, "error");
    const email = forgotEmail.trim().toLowerCase();
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/reset`,
    });
    setBusy(false);
    // Never reveal whether the email exists (matches old Auth.forgot behavior).
    toast("If an account exists for that email, a reset link is on its way.", "success");
    setPanel("login");
    setLoginEmail(email);
  }

  const show = (p: Panel) => (panel === p ? "" : "hidden");

  return (
    <div className="auth-view">
      <div className="auth-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Pickle Ball Logo.jpg" alt="J's Pickle Yard logo" className="auth-logo" />
        <p className="tagline">PLAY &nbsp;•&nbsp; CONNECT &nbsp;•&nbsp; COMPETE</p>
        <p style={{ marginTop: ".8rem" }}>
          <Link className="link" href="/">
            ← Back to home
          </Link>
        </p>
      </div>
      <div className="auth-card">
        {/* Login */}
        <form className={`auth-panel ${show("login")}`} autoComplete="on" onSubmit={onLogin}>
          <h2>Welcome back</h2>
          <p className="muted">Sign in to book your court.</p>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <div className="pw-wrap">
              <input
                type={showLoginPw ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowLoginPw((s) => !s)}>
                👁
              </button>
            </div>
          </label>
          <div className="row between">
            <label className="check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
            </label>
            <a
              href="#"
              className="link"
              onClick={(e) => {
                e.preventDefault();
                setPanel("forgot");
              }}
            >
              Forgot password?
            </a>
          </div>
          <button className="btn primary block" type="submit" disabled={busy}>
            Sign In
          </button>
          <p className="switch muted">
            New here?{" "}
            <a
              href="#"
              className="link"
              onClick={(e) => {
                e.preventDefault();
                setPanel("register");
              }}
            >
              Create an account
            </a>
          </p>
        </form>

        {/* Register */}
        <form className={`auth-panel ${show("register")}`} autoComplete="on" onSubmit={onRegister}>
          <h2>Create account</h2>
          <p className="muted">Join J&apos;s Pickle Yard in under a minute.</p>
          <label>
            Full name
            <input
              type="text"
              required
              autoComplete="name"
              placeholder="Juan Dela Cruz"
              maxLength={60}
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
            />
          </label>
          <label>
            Mobile number <span className="muted small">(optional)</span>
            <input
              type="tel"
              autoComplete="tel"
              placeholder="09XX XXX XXXX"
              maxLength={20}
              value={regPhone}
              onChange={(e) => setRegPhone(e.target.value)}
            />
          </label>
          <label>
            Password
            <div className="pw-wrap">
              <input
                type={showRegPw ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="Min. 8 chars, letters & numbers"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowRegPw((s) => !s)}>
                👁
              </button>
            </div>
          </label>
          <div className="pw-meter">
            <span style={{ width: regPassword ? strength.width : "8%", background: strength.background }}></span>
          </div>
          <label>
            Confirm password
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Repeat password"
              value={regPassword2}
              onChange={(e) => setRegPassword2(e.target.value)}
            />
          </label>
          <button className="btn primary block" type="submit" disabled={busy}>
            Create Account
          </button>
          <p className="switch muted">
            Already a member?{" "}
            <a
              href="#"
              className="link"
              onClick={(e) => {
                e.preventDefault();
                setPanel("login");
              }}
            >
              Sign in
            </a>
          </p>
        </form>

        {/* Verify email (now points to the real inbox) */}
        <form className={`auth-panel ${show("verify")}`} onSubmit={(e) => e.preventDefault()}>
          <h2>Verify your email</h2>
          <p className="muted">
            We sent a confirmation link to <strong>{pendingEmail}</strong>. Click it to activate your account, then sign
            in.
          </p>
          <button className="btn primary block" type="button" onClick={() => setPanel("login")}>
            Back to Sign In
          </button>
          <p className="switch muted">
            Didn&apos;t get it?{" "}
            <a
              href="#"
              className="link"
              onClick={(e) => {
                e.preventDefault();
                resendConfirm();
              }}
            >
              Resend email
            </a>
          </p>
        </form>

        {/* Forgot password */}
        <form className={`auth-panel ${show("forgot")}`} onSubmit={onForgot}>
          <h2>Reset password</h2>
          <p className="muted">Enter your account email and we&apos;ll send a reset link.</p>
          <label>
            Email
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
            />
          </label>
          <button className="btn primary block" type="submit" disabled={busy}>
            Send Reset Link
          </button>
          <p className="switch muted">
            <a
              href="#"
              className="link"
              onClick={(e) => {
                e.preventDefault();
                setPanel("login");
              }}
            >
              Back to sign in
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
