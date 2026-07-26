"use client";
/* Profile edit forms — ported from profile.html's inline script, rewired to
   Supabase (update profile row + change password). Same markup/classes. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { validPassword } from "@/lib/helpers";

export default function ProfileClient({
  name: initName,
  phone: initPhone,
  email,
}: {
  name: string;
  phone: string;
  email: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [name, setName] = useState(initName);
  const [phone, setPhone] = useState(initPhone);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showNext2, setShowNext2] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast("Name cannot be empty.", "error");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return toast("Session expired — please sign in again.", "error");
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim(), phone: phone.trim() })
      .eq("id", user.id);
    if (error) return toast("Couldn't save your profile.", "error");
    toast("Profile updated.", "success");
    router.refresh(); // refresh the header chip
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!validPassword(next))
      return toast("New password must be at least 8 characters with letters and numbers.", "error");
    if (next !== next2) return toast("New passwords do not match.", "error");
    // verify current password by re-authenticating
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: cur });
    if (verifyErr) return toast("Current password is incorrect.", "error");
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) return toast(error.message, "error");
    setCur("");
    setNext("");
    setNext2("");
    toast("Password changed.", "success");
  }

  return (
    <div className="grid-2">
      <div className="card">
        <h3>Account details</h3>
        <form onSubmit={saveProfile}>
          <label>
            Full name <input type="text" maxLength={60} required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Mobile number <input type="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label>
            Email <input type="email" disabled value={email} />
          </label>
          <button className="btn primary" type="submit">
            Save Changes
          </button>
        </form>
      </div>
      <div className="card">
        <h3>Change password</h3>
        <form onSubmit={changePassword}>
          <label>
            Current password{" "}
            <div className="pw-wrap">
              <input
                type={showCur ? "text" : "password"}
                required
                autoComplete="current-password"
                value={cur}
                onChange={(e) => setCur(e.target.value)}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowCur((s) => !s)}>
                {showCur ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <label>
            New password{" "}
            <div className="pw-wrap">
              <input
                type={showNext ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="Min. 8 chars, letters & numbers"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowNext((s) => !s)}>
                {showNext ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <label>
            Confirm new password{" "}
            <div className="pw-wrap">
              <input
                type={showNext2 ? "text" : "password"}
                required
                autoComplete="new-password"
                value={next2}
                onChange={(e) => setNext2(e.target.value)}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowNext2((s) => !s)}>
                {showNext2 ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <button className="btn primary" type="submit">
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
}
