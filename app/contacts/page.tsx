import type { Metadata } from "next";
import { getSettings, getSiteConfig } from "@/lib/data";
import { fmtHour } from "@/lib/helpers";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = { title: "Contacts — J's Pickle Yard" };

export default async function ContactsPage() {
  const [s, c] = await Promise.all([getSettings(), getSiteConfig()]);
  const hrs = `${fmtHour(s.openHour)} – ${fmtHour(s.closeHour)}`;

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
            <li><div><strong>Address</strong><br /><span className="muted">{c.address}</span></div></li>
            <li><div><strong>Phone / Viber</strong><br /><span className="muted">{c.phone}</span></div></li>
            <li><div><strong>Email</strong><br /><span className="muted">{c.email}</span></div></li>
            <li><div><strong>Operating hours</strong><br /><span className="muted">Daily, <span>{hrs}</span></span></div></li>
            <li><div><strong>Socials</strong><br /><span className="muted">{c.socials}</span></div></li>
          </ul>
        </div>

        <div className="card">
          <h3>Send us a message</h3>
          <ContactForm />
        </div>
      </div>

      <div className="card map-embed-card map-card">
        <iframe
          title="J's Pickle Yard location map"
          src={`https://maps.google.com/maps?q=${c.mapLat},${c.mapLng}&z=17&output=embed`}
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

      {c.landmarkImage && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3>Landmark — what to look for</h3>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={c.landmarkImage}
            alt="Landmark near J's Pickle Yard"
            style={{ width: "100%", borderRadius: "10px", marginTop: ".6rem" }}
          />
        </div>
      )}

      <p className="muted small center" style={{ marginTop: ".6rem" }}>
        {c.note}
      </p>
    </main>
  );
}
