"use client";
/* Contact form island — posts to admins via a server action (Supabase). */
import { useState } from "react";
import { useToast } from "@/components/toast";
import { sendContactMessage } from "@/lib/actions/notifications";

export default function ContactForm() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await sendContactMessage(name, email, msg);
    setBusy(false);
    if (!res.ok) return toast(res.error || "Could not send.", "error");
    setName("");
    setEmail("");
    setMsg("");
    toast("Message sent! We'll get back to you soon.", "success");
  }

  return (
    <form onSubmit={onSubmit}>
      <label>
        Your name
        <input type="text" required maxLength={60} placeholder="Juan Dela Cruz" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Email
        <input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Message
        <textarea required rows={5} maxLength={1000} placeholder="How can we help?" value={msg} onChange={(e) => setMsg(e.target.value)} />
      </label>
      <button className="btn primary" type="submit" disabled={busy}>
        Send Message
      </button>
    </form>
  );
}
