"use client";
/* New-password step for the password-reset email link. The Supabase callback
   has already established a session, so we just call updateUser. Reuses the
   auth-view/auth-card markup for visual consistency with the login page. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { validPassword } from "@/lib/helpers";
import { SUPABASE_CONFIGURED, NOT_CONFIGURED_MSG } from "@/lib/supabaseConfig";

export default function ResetPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!SUPABASE_CONFIGURED) return toast(NOT_CONFIGURED_MSG, "error");
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
                👁
              </button>
            </div>
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Repeat password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
            />
          </label>
          <button className="btn primary block" type="submit" disabled={busy}>
            Set New Password
          </button>
        </form>
      </div>
    </div>
  );
}
