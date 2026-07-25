/* Landing page — ported from index.html. Now server-rendered from Supabase
   (settings, courts, site config, reviews, gallery), with two client islands:
   the gallery slideshow and the review form. */
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getActiveCourts, getSettings, getSiteConfig, getPublishedReviews, getMyReview, getGallery } from "@/lib/data";
import { fmtHour, money, GALLERY_PLACEHOLDER } from "@/lib/helpers";
import HomeGallery from "@/components/HomeGallery";

/* p1.jpg … p5.jpg ship in /public as the default court photos. */
const DEFAULT_PHOTO_COUNT = 5;

/* Resolve the slideshow's photo list on the server: admin override wins,
   otherwise the shipped default photo, otherwise the slot is skipped. */
function resolveGallerySources(overrides: (string | null)[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < 10; i++) {
    const ov = overrides[i];
    if (ov) out.push(ov);
    else if (i < DEFAULT_PHOTO_COUNT) out.push(`/p${i + 1}.jpg`);
  }
  return out.length ? out : [GALLERY_PLACEHOLDER];
}
import ReviewForm from "@/components/ReviewForm";

const SAMPLE_REVIEWS = [
  { name: "Migs R., 4.0 player", rating: 5, text: "Booking takes literally 30 seconds. Best-maintained courts in the city — the night lighting is perfect." },
  { name: "Kat D., weekend warrior", rating: 5, text: "We book 3 hours every Saturday and the multi-hour discount really adds up. The open-play nights got my whole barkada hooked!" },
  { name: "Paolo S., newbie no more", rating: 4, text: "Started as a total beginner at their clinic. Six months later I'm joining the monthly tournament. This place is a community." },
];

function stars(n: number) {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

export default async function HomePage() {
  const [user, s, courts, c, published, gallery] = await Promise.all([
    getCurrentUser(),
    getSettings(),
    getActiveCourts(),
    getSiteConfig(),
    getPublishedReviews(),
    getGallery(),
  ]);
  const myReview = user ? await getMyReview(user.id) : null;

  const hrs = `${fmtHour(s.openHour)} – ${fmtHour(s.closeHour)}`;
  const m = (n: number) => money(s, n);
  const reviewList = published.length ? published.slice(0, 6) : SAMPLE_REVIEWS;

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Pickle Ball Logo.jpg" alt="J's Pickle Yard logo" className="hero-logo" />
          <h1 className="neon">
            Your Home Court
            <br />
            For <em>Pickleball</em>
          </h1>
          <p className="hero-sub">
            Premium courts, easy online booking, and a community that loves the game. Open daily <strong>{hrs}</strong>.
          </p>
          <div className="hero-cta">
            <Link className="btn primary big" href="/book">
              Book a Court →
            </Link>
            <Link className="btn ghost big" href="/pricing">
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="page-wrap stat-band">
          <div className="stat"><div className="stat-num">{courts.length}</div><div className="stat-label">Courts</div></div>
          <div className="stat"><div className="stat-num">14</div><div className="stat-label">Hours open daily</div></div>
          <div className="stat"><div className="stat-num">{m(s.pricePerHour)}</div><div className="stat-label">Per hour</div></div>
          <div className="stat"><div className="stat-num">7 days</div><div className="stat-label">A week</div></div>
        </div>
      </section>

      <section className="page-wrap section">
        <h2 className="section-title neon">Inside The Yard</h2>
        <HomeGallery sources={resolveGallerySources(gallery)} />
      </section>

      <section className="page-wrap section">
        <h2 className="section-title neon">Why Play At J&apos;s?</h2>
        <div className="feature-grid">
          <div className="card feature"><span className="f-ico">🎾</span><h3>Tournament-Grade Courts</h3><p className="muted">Professional surfacing, regulation nets, and bright night lighting for evening games.</p></div>
          <div className="card feature"><span className="f-ico">📅</span><h3>Real-Time Booking</h3><p className="muted">See live availability, reserve in seconds, and get instant confirmation with a booking reference.</p></div>
          <div className="card feature"><span className="f-ico">🏓</span><h3>Gear Rentals</h3><p className="muted">No paddle? Rent one for ₱50/hour at checkout — balls are on the house.</p></div>
          <div className="card feature"><span className="f-ico">💸</span><h3>Multi-Hour Discounts</h3><p className="muted">Play longer for less — every hour after your first two is ₱50 off.</p></div>
          <div className="card feature"><span className="f-ico">🚿</span><h3>Player Amenities</h3><p className="muted">Free parking, showers, lockers, and a chill lounge for between-game recovery.</p></div>
          <div className="card feature"><span className="f-ico">🤝</span><h3>Open Play &amp; Events</h3><p className="muted">Weekly open-play nights, beginner clinics, and monthly tournaments for all levels.</p></div>
        </div>
      </section>

      <section className="band">
        <div className="page-wrap section">
          <h2 className="section-title neon">Booking In 3 Easy Steps</h2>
          <div className="steps">
            <div className="step"><span className="step-num">1</span><h3>Create an account</h3><p className="muted">Register with your email and verify it — takes under a minute.</p></div>
            <div className="step-arrow">→</div>
            <div className="step"><span className="step-num">2</span><h3>Pick your slot</h3><p className="muted">Choose a court, date, and time from the live availability calendar.</p></div>
            <div className="step-arrow">→</div>
            <div className="step"><span className="step-num">3</span><h3>Pay &amp; play</h3><p className="muted">Pay by GCash, card, or at the venue. Show your booking reference and hit the court!</p></div>
          </div>
        </div>
      </section>

      <section className="page-wrap section">
        <h2 className="section-title neon">Simple, Honest Pricing</h2>
        <div className="price-grid">
          <div className="card price-card featured">
            <div className="price-icon">🎾</div>
            <h3>Court Rate</h3>
            <div className="big-price"><span>{m(s.pricePerHour)}</span><span className="per">/ hr · weekday</span></div>
            <div className="big-price"><span>{m(s.weekendPricePerHour)}</span><span className="per">/ hr · weekend</span></div>
            <p className="muted small">Per court, minimum 1 hour</p>
          </div>
          <div className="card price-card">
            <div className="price-icon">⏱</div>
            <h3>Multi-Hour Discount</h3>
            <div className="big-price"><span>{m(s.discountPerHour)}</span><span className="per">/ hour off</span></div>
            <p className="muted small">{m(s.discountPerHour)} off every hour after your first {s.discountAfterHours}</p>
          </div>
          <div className="card price-card">
            <div className="price-icon">🏓</div>
            <h3>Paddle Rental</h3>
            <div className="big-price"><span>{m(s.paddleRentPerHour)}</span><span className="per">/ paddle / hr</span></div>
            <p className="muted small">Balls included, free of charge</p>
          </div>
        </div>
        <p className="center" style={{ marginTop: "1rem" }}>
          <Link className="link" href="/pricing">
            See full pricing &amp; sample computations →
          </Link>
        </p>
      </section>

      <section className="page-wrap section">
        <h2 className="section-title neon">Find The Yard</h2>
        <div className="map-grid">
          <div className="card">
            <h3>📍 Location &amp; Hours</h3>
            <ul className="contact-list">
              <li><span className="c-ico">🏟</span><div><strong>J&apos;s Pickle Yard</strong><br /><span className="muted">{c.address}</span></div></li>
              <li><span className="c-ico">🕗</span><div><strong>Open daily</strong><br /><span className="muted">{hrs}</span></div></li>
              <li><span className="c-ico">📞</span><div><strong>{c.phone}</strong><br /><span className="muted">Call or Viber for group events</span></div></li>
              <li><span className="c-ico">🅿️</span><div><strong>Getting here</strong><br /><span className="muted">{c.note}</span></div></li>
            </ul>
            <Link className="btn primary" style={{ marginTop: ".6rem" }} href="/contacts">
              Contact Us
            </Link>
          </div>
          <div className="card map-embed-card">
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
        </div>
      </section>

      <section className="band">
        <div className="page-wrap section">
          <h2 className="section-title neon">What Players Say</h2>
          <div className="quote-grid">
            {reviewList.map((r: any, i: number) => (
              <div className="card quote" key={r.id || i}>
                <span className="stars-show" aria-label={`${r.rating} out of 5 stars`}>
                  {stars(r.rating)}
                </span>
                <p>&quot;{r.text}&quot;</p>
                <span className="q-who">— {r.name}</span>
              </div>
            ))}
          </div>
          <ReviewForm existingRating={myReview?.rating ?? null} existingText={myReview?.text ?? null} />
        </div>
      </section>

      <section className="page-wrap">
        <div className="cta-band big-cta">
          <div>
            <strong className="neon">Ready to rally?</strong>
            <p className="muted" style={{ marginTop: ".2rem" }}>
              Courts fill up fast on weekends — lock in your slot now.
            </p>
          </div>
          <Link className="btn primary big" href="/book">
            Book a Court →
          </Link>
        </div>
      </section>
    </>
  );
}
