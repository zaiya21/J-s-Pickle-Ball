"use client";
/* Password-reset landing page. The reset email links straight here. This page
   establishes the recovery session from whatever the link carries — a `code`
   (PKCE), a `token_hash` (OTP), or an `#access_token` hash (auto-detected by the
   Supabase client) — then lets the user set a new password. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { validPassword } from "@/lib/helpers";
import { SUPABASE_CONFIGURED, NOT_CONFIGURED_MSG } from "@/lib/supabaseConfig";

type Phase = "verifying" | "ready" | "invalid";

export default function ResetPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [supabase] = useState(() => createClient());
  const [phase, setPhase] = useState<Phase>("verifying");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [show2, setShow2] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setPhase("invalid");
      return;
    }
    let settled = false;
    // Supabase auto-detects a recovery session from the URL hash and fires this.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        settled = true;
        setPhase("ready");
      }
    });
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = params.get("type") as EmailOtpType | null;
      try {
        if (code) await supabase.auth.exchangeCodeForSession(code);
        else if (tokenHash && type) await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      } catch {
        /* fall through to the session check below */
      }
      const { data } = await supabase.auth.getSession();
      if (!settled) setPhase(data.session ? "ready" : "invalid");
    })();
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validPassword(pw))
      return toast("Password must be at least 8 characters with letters and numbers.", "error");
    if (pw !== pw2) return toast("Passwords do not match.", "error");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast(error.message, "error");
    toast("Password updated — you're signed in.", "success");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="auth-view">
      <div className="auth-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Pickle Ball Logo.jpg" alt="J's Pickle Yard logo" className="auth-logo" />
        <p className="tagline">PLAY &nbsp;•&nbsp; CONNECT &nbsp;•&nbsp; COMPETE</p>
      </div>
      <div className="auth-card">
        {phase === "verifying" && (
          <div className="auth-panel">
            <h2>Verifying…</h2>
            <p className="muted">Checking your reset link.</p>
          </div>
        )}

        {phase === "invalid" && (
          <div className="auth-panel">
            <h2>Link expired</h2>
            <p className="muted">
              {SUPABASE_CONFIGURED
                ? "This password reset link is invalid or has already been used. Request a new one from the sign-in page."
                : NOT_CONFIGURED_MSG}
            </p>
            <p className="switch muted" style={{ marginTop: ".8rem" }}>
              <Link className="link" href="/login">
                Back to sign in
              </Link>
            </p>
          </div>
        )}

        {phase === "ready" && (
          <form className="auth-panel" onSubmit={onSubmit}>
            <h2>New password</h2>
            <p className="muted">Choose a new password for your account.</p>
            <label>
              New password
              <div className="pw-wrap">
                <input
                  type={show ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="Min. 8 chars, letters & numbers"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
                <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)}>
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <label>
              Confirm new password
              <div className="pw-wrap">
                <input
                  type={show2 ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                />
                <button type="button" className="pw-toggle" onClick={() => setShow2((s) => !s)}>
                  {show2 ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <button className="btn primary block" type="submit" disabled={busy}>
              Set New Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
