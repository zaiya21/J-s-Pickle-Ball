"use client";
/* Contacts — ported from contacts.html + its inline script. Contact info and
   the message form stay on the client content model (clientDb), as before. */
import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { DB } from "@/lib/clientDb";
import { fmtHour } from "@/lib/helpers";

export default function ContactsPage() {
  const { toast } = useToast();
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    DB.load();
    setLoaded(true);
  }, []);

  const s = loaded ? DB.data!.settings : DB.defaults().settings;
  const c = loaded ? DB.data!.contact : DB.defaults().contact;
  const hrs = `${fmtHour(s.openHour)} – ${fmtHour(s.closeHour)}`;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    DB.load();
    DB.notifyAdmins(`📨 Message from ${name.trim()} (${email.trim()}): "${msg.trim().slice(0, 200)}"`);
    setName("");
    setEmail("");
    setMsg("");
    toast("Message sent! We'll get back to you soon.", "success");
  }

  return (
    <main className="page-wrap">
      <div className="page-head">
        <h1>Contact Us</h1>
        <p className="muted">Questions, group events, or tournament inquiries — reach out anytime.</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Get in touch</h3>
          <ul className="contact-list">
            <li><span className="c-ico">📍</span><div><strong>Address</strong><br /><span className="muted">{c.address}</span></div></li>
            <li><span className="c-ico">📞</span><div><strong>Phone / Viber</strong><br /><span className="muted">{c.phone}</span></div></li>
            <li><span className="c-ico">✉️</span><div><strong>Email</strong><br /><span className="muted">{c.email}</span></div></li>
            <li><span className="c-ico">🕗</span><div><strong>Operating hours</strong><br /><span className="muted">Daily, <span>{hrs}</span></span></div></li>
            <li><span className="c-ico">📱</span><div><strong>Socials</strong><br /><span className="muted">{c.socials}</span></div></li>
          </ul>
        </div>

        <div className="card">
          <h3>Send us a message</h3>
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
            <button className="btn primary" type="submit">
              Send Message
            </button>
          </form>
        </div>
      </div>

      <div className="card map-embed-card map-card">
        <iframe
          title="J's Pickle Yard location map"
          src="https://maps.google.com/maps?q=7.045760737335788,125.52425272530164&z=17&output=embed"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        ></iframe>
        <div className="map-pin-overlay">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Pickle Ball Logo.jpg" alt="J's Pickle Yard is here" />
          <span className="pin-label">The Yard is here!</span>
          <span className="pin-tip">▼</span>
        </div>
      </div>
      <p className="muted small center" style={{ marginTop: ".6rem" }}>
        {c.note}
      </p>
    </main>
  );
}
