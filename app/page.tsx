"use client";
/* Landing page — ported from index.html + its inline script. Stays on the
   client content model (clientDb) for reviews/gallery/contact, exactly as the
   original did. Marketing numbers use the client settings defaults. */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/session";
import { useToast } from "@/components/toast";
import { DB } from "@/lib/clientDb";
import { GALLERY_PLACEHOLDER, fmtHour } from "@/lib/helpers";

const SAMPLE_REVIEWS = [
  { name: "Migs R., 4.0 player", rating: 5, text: "Booking takes literally 30 seconds. Best-maintained courts in the city — the night lighting is perfect." },
  { name: "Kat D., weekend warrior", rating: 5, text: "We book 3 hours every Saturday and the multi-hour discount really adds up. The open-play nights got my whole barkada hooked!" },
  { name: "Paolo S., newbie no more", rating: 4, text: "Started as a total beginner at their clinic. Six months later I'm joining the monthly tournament. This place is a community." },
];

function Stars({ n }: { n: number }) {
  return (
    <span className="stars-show" aria-label={`${n} out of 5 stars`}>
      {"★".repeat(n)}
      {"☆".repeat(5 - n)}
    </span>
  );
}

function tryLoadImage(cands: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    let k = 0;
    const img = new Image();
    img.onload = () => resolve(cands[k]);
    img.onerror = () => {
      k++;
      if (k < cands.length) img.src = cands[k];
      else resolve(null);
    };
    img.src = cands[0];
  });
}

function HomeGallery() {
  const [sources, setSources] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const frontRef = useRef<HTMLImageElement>(null);
  const backRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      DB.load();
      const out: string[] = [];
      for (let i = 0; i < 10; i++) {
        const ov = (DB.data!.gallery || [])[i];
        if (ov) {
          out.push(ov);
          continue;
        }
        const n = i + 1;
        const src = await tryLoadImage([`/p${n}.jpg`, `/p${n}.png`, `/p${n}.jpeg`, `/p${n}.webp`]);
        if (src) out.push(src);
      }
      if (!alive) return;
      setSources(out.length ? out : [GALLERY_PLACEHOLDER]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (sources.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setInterval(() => goTo((idx + 1) % sources.length), 5000);
      return () => clearInterval(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, idx]);

  function goTo(n: number) {
    if (n === idx) return;
    const front = frontRef.current;
    const back = backRef.current;
    if (!front || !back) return;
    back.onload = () => {
      requestAnimationFrame(() => back.classList.add("show"));
      setTimeout(() => {
        front.src = back.src;
        back.classList.remove("show");
        setIdx(n);
      }, 1300);
    };
    back.src = sources[n];
  }

  if (!sources.length) return <div className="home-gallery" />;

  return (
    <div className="home-gallery">
      <div className="slideshow">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={frontRef} className="layer-front" src={sources[0]} alt="J's Pickle Yard court photo" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={backRef} className="layer-back" alt="" aria-hidden="true" />
        <div className="slide-dots">
          {sources.map((_, i) => (
            <button key={i} className={`dot ${i === idx ? "on" : ""}`} title={`Photo ${i + 1}`} onClick={() => goTo(i)} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const user = useSession();
  const { toast } = useToast();
  const [loaded, setLoaded] = useState(false);
  const [reviewsVer, setReviewsVer] = useState(0);
  const [pickedRating, setPickedRating] = useState(5);
  const [reviewText, setReviewText] = useState("");

  useEffect(() => {
    DB.load();
    const mine = user ? (DB.data!.reviews || []).find((r: any) => r.userId === user.id) : null;
    if (mine) {
      setPickedRating(mine.rating);
      setReviewText(mine.text);
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const s = useMemo(() => (loaded ? DB.data!.settings : DB.defaults().settings), [loaded]);
  const c = useMemo(() => (loaded ? DB.data!.contact : DB.defaults().contact), [loaded]);
  const money = (n: number) => s.currency + Number(n).toLocaleString();
  const hrs = `${fmtHour(s.openHour)} – ${fmtHour(s.closeHour)}`;
  const activeCourts = loaded ? DB.data!.courts.filter((x: any) => x.active).length : 3;

  const published = loaded
    ? (DB.data!.reviews || []).filter((r: any) => r.status === "published").sort((a: any, b: any) => b.at - a.at)
    : [];
  const reviewList = published.length ? published.slice(0, 6) : SAMPLE_REVIEWS;
  const mine = loaded && user ? (DB.data!.reviews || []).find((r: any) => r.userId === user.id) : null;

  function submitReview(e: React.FormEvent) {
    e.preventDefault();
    const text = reviewText.trim();
    if (!text) return;
    DB.load();
    const existing = (DB.data!.reviews || []).find((r: any) => r.userId === user!.id);
    if (existing) {
      existing.rating = pickedRating;
      existing.text = text;
      existing.at = Date.now();
      existing.status = "published";
    } else {
      DB.data!.reviews.push({
        id: DB.nextId("r"),
        userId: user!.id,
        name: user!.name,
        rating: pickedRating,
        text,
        at: Date.now(),
        status: "published",
      });
      DB.notifyAdmins(`⭐ New ${pickedRating}-star review from ${user!.name}.`);
    }
    DB.save();
    toast("Thanks for your review! 🎉", "success");
    setReviewsVer((v) => v + 1);
  }

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
            Premium courts, easy online booking, and a community that loves the game. Open daily{" "}
            <strong>{hrs}</strong>.
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
          <div className="stat">
            <div className="stat-num">{activeCourts}</div>
            <div className="stat-label">Courts</div>
          </div>
          <div className="stat">
            <div className="stat-num">14</div>
            <div className="stat-label">Hours open daily</div>
          </div>
          <div className="stat">
            <div className="stat-num">{money(s.pricePerHour)}</div>
            <div className="stat-label">Per hour</div>
          </div>
          <div className="stat">
            <div className="stat-num">7 days</div>
            <div className="stat-label">A week</div>
          </div>
        </div>
      </section>

      <section className="page-wrap section">
        <h2 className="section-title neon">Inside The Yard</h2>
        <HomeGallery />
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
            <div className="big-price">
              <span>{money(s.pricePerHour)}</span>
              <span className="per">/ hour</span>
            </div>
            <p className="muted small">Per court, minimum 1 hour</p>
          </div>
          <div className="card price-card">
            <div className="price-icon">⏱</div>
            <h3>Extra Hours</h3>
            <div className="big-price">
              <span>{money(s.pricePerHour - s.discountPerHour)}</span>
              <span className="per">/ hour</span>
            </div>
            <p className="muted small">₱50 off every hour after your first 2</p>
          </div>
          <div className="card price-card">
            <div className="price-icon">🏓</div>
            <h3>Paddle Rental</h3>
            <div className="big-price">
              <span>{money(s.paddleRentPerHour)}</span>
              <span className="per">/ paddle / hr</span>
            </div>
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
        </div>
      </section>

      <section className="band" key={reviewsVer}>
        <div className="page-wrap section">
          <h2 className="section-title neon">What Players Say</h2>
          <div className="quote-grid">
            {reviewList.map((r: any, i: number) => (
              <div className="card quote" key={r.id || i}>
                <Stars n={r.rating} />
                <p>&quot;{r.text}&quot;</p>
                <span className="q-who">— {r.name}</span>
              </div>
            ))}
          </div>
          <div className="card review-card">
            {!user ? (
              <>
                <p className="center muted">Played at the Yard? We&apos;d love to hear from you.</p>
                <p className="center" style={{ marginTop: ".6rem" }}>
                  <Link className="btn primary" href="/login">
                    Sign in to leave a review
                  </Link>
                </p>
              </>
            ) : (
              <>
                <h3 className="center">{mine ? "Edit your review" : "Leave a review"}</h3>
                <div className="star-picker center">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`star-btn ${n <= pickedRating ? "on" : ""}`}
                      onClick={() => setPickedRating(n)}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <form onSubmit={submitReview}>
                  <label>
                    Your comment
                    <textarea
                      rows={3}
                      maxLength={300}
                      required
                      placeholder="How was your game at J's Pickle Yard?"
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                    />
                  </label>
                  <div className="center">
                    <button className="btn primary" type="submit">
                      {mine ? "Update Review" : "Post Review"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
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
