"use client";
/* Email-confirmation landing page. The signup confirmation email links here.
   It verifies the token, then (deliberately) signs the user out so they must
   log in explicitly — showing "Email confirmed, proceed to login". */
import { useEffect, useState } from "react";
import Link from "next/link";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { SUPABASE_CONFIGURED } from "@/lib/supabaseConfig";

type Phase = "verifying" | "ok" | "invalid";

export default function ConfirmPage() {
  const [supabase] = useState(() => createClient());
  const [phase, setPhase] = useState<Phase>("verifying");

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setPhase("invalid");
      return;
    }
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = (params.get("type") as EmailOtpType | null) ?? "signup";
      let ok = false;
      try {
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
          ok = !error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          ok = !error;
        } else {
          // hash-based link — the client auto-detects the session from the URL
          const { data } = await supabase.auth.getSession();
          ok = !!data.session;
        }
      } catch {
        ok = false;
      }
      // Don't leave them auto-signed-in — make them log in explicitly.
      if (ok) await supabase.auth.signOut().catch(() => {});
      setPhase(ok ? "ok" : "invalid");
    })();
  }, [supabase]);

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
            <h2>Confirming…</h2>
            <p className="muted">Verifying your email address.</p>
          </div>
        )}

        {phase === "ok" && (
          <div className="auth-panel">
            <div className="receipt-check">✓</div>
            <h2 className="center">Email confirmed!</h2>
            <p className="muted center">
              Your email address has been verified. You can now sign in to your J&apos;s Pickle Yard account.
            </p>
            <Link className="btn primary block" href="/login" style={{ marginTop: ".8rem" }}>
              Proceed to Login
            </Link>
          </div>
        )}

        {phase === "invalid" && (
          <div className="auth-panel">
            <h2>Confirmation failed</h2>
            <p className="muted">
              This confirmation link is invalid or has already been used. Try signing in — or register again if you
              haven&apos;t got an account yet.
            </p>
            <Link className="btn primary block" href="/login" style={{ marginTop: ".8rem" }}>
              Go to Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
