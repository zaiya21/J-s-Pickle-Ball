import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { calcCourtCost, fmtHour, money } from "@/lib/helpers";

export const metadata: Metadata = { title: "Pricing — J's Pickle Yard" };

export default async function PricingPage() {
  const [s, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const m = (n: number) => money(s, n);

  const rows = [1, 2, 3, 4].map((h) => {
    const full = Math.min(h, s.discountAfterHours);
    const extra = Math.max(0, h - s.discountAfterHours);
    let calc = `${full} hr × ${m(s.pricePerHour)}`;
    if (extra) calc += ` + ${extra} hr × ${m(s.pricePerHour - s.discountPerHour)}`;
    return { h, calc, total: calcCourtCost(s, h) };
  });

  return (
    <main className="page-wrap">
      <div className="page-head">
        <h1>Pricing</h1>
        <p className="muted">Simple hourly rates, per court. The longer you play, the cheaper it gets.</p>
      </div>

      <div className="price-grid">
        <div className="card price-card featured">
          <div className="price-icon">🎾</div>
          <h3>Court Rate</h3>
          <div className="big-price">
            <span>{m(s.pricePerHour)}</span>
            <span className="per">/ hour</span>
          </div>
          <p className="muted small">
            Per court · minimum booking of 1 hour · open daily{" "}
            <span>{`${fmtHour(s.openHour)} – ${fmtHour(s.closeHour)}`}</span>
          </p>
        </div>

        <div className="card price-card">
          <div className="price-icon">⏱</div>
          <h3>Multi-Hour Discount</h3>
          <div className="big-price">
            <span>{m(s.pricePerHour - s.discountPerHour)}</span>
            <span className="per">/ hour</span>
          </div>
          <p className="muted small">
            Book more than <span>{s.discountAfterHours}</span> hours and every extra hour gets <span>{m(s.discountPerHour)}</span> off.
          </p>
        </div>

        <div className="card price-card">
          <div className="price-icon">🏓</div>
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
                <th>Computation</th>
                <th>Court total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.h}>
                  <td>
                    {r.h} hour{r.h > 1 ? "s" : ""}
                  </td>
                  <td>{r.calc}</td>
                  <td>
                    <strong className="price">{m(r.total)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ marginTop: ".7rem" }}>
          Cancellation is free up to <span>{s.cancelHours}</span> hours before your start time — paid bookings are refunded (simulated).
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
