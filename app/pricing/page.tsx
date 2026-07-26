import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { calcCourtCost, fmtHour, money } from "@/lib/helpers";

export const metadata: Metadata = { title: "Pricing — J's Pickle Yard" };

export default async function PricingPage() {
  const [s, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const m = (n: number) => money(s, n);

  return (
    <main className="page-wrap">
      <div className="page-head">
        <h1>Pricing</h1>
        <p className="muted">Simple hourly rates, per court — weekday and weekend. The longer you play, the cheaper it gets.</p>
      </div>

      <div className="price-grid">
        <div className="card price-card featured">
          <h3>Court Rate</h3>
          <div className="big-price">
            <span>{m(s.pricePerHour)}</span>
            <span className="per">/ hr · weekday</span>
          </div>
          <div className="big-price">
            <span>{m(s.weekendPricePerHour)}</span>
            <span className="per">/ hr · weekend</span>
          </div>
          <p className="muted small">
            Per court · Mon–Fri vs Sat–Sun · minimum 1 hour · open daily {`${fmtHour(s.openHour)} – ${fmtHour(s.closeHour)}`}
          </p>
        </div>

        <div className="card price-card">
          <h3>Multi-Hour Discount</h3>
          <div className="big-price">
            <span>{m(s.discountPerHour)}</span>
            <span className="per">/ hour off</span>
          </div>
          <p className="muted small">
            Book more than <span>{s.discountAfterHours}</span> hours and every extra hour is <span>{m(s.discountPerHour)}</span> off the base rate — on both weekday and weekend prices.
          </p>
        </div>

        <div className="card price-card">
          <h3>Paddle Rental</h3>
          <div className="big-price">
            <span>{m(s.paddleRentPerHour)}</span>
            <span className="per">/ paddle / hour</span>
          </div>
          <p className="muted small">No gear? No problem — add rental paddles at checkout.</p>
        </div>
      </div>

      <div className="card chart-card">
        <div className="chart-title">Sample computations</div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Session</th>
                <th>Weekday total</th>
                <th>Weekend total</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map((h) => (
                <tr key={h}>
                  <td>
                    {h} hour{h > 1 ? "s" : ""}
                  </td>
                  <td>
                    <strong className="price">{m(calcCourtCost(s, h, false))}</strong>
                  </td>
                  <td>
                    <strong className="price">{m(calcCourtCost(s, h, true))}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ marginTop: ".7rem" }}>
          The multi-hour discount ({m(s.discountPerHour)}/hr off) kicks in after {s.discountAfterHours} hours. Weekends are Saturday &amp; Sunday. Cancellation is free up to <span>{s.cancelHours}</span> hours before your start time — paid bookings are refunded (simulated).
        </p>
      </div>

      <div className="cta-band">
        <strong>Ready to play?</strong>
        <Link className="btn primary" href={user ? "/book" : "/login"}>
          Book a Court →
        </Link>
      </div>
    </main>
  );
}
