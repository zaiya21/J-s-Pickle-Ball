/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // Preserve old static URLs — 301 to the clean Next.js routes.
    const map = [
      ["/index.html", "/"],
      ["/book.html", "/book"],
      ["/login.html", "/login"],
      ["/my-bookings.html", "/my-bookings"],
      ["/pricing.html", "/pricing"],
      ["/events.html", "/events"],
      ["/contacts.html", "/contacts"],
      ["/profile.html", "/profile"],
      ["/admin.html", "/admin"],
    ];
    return map.map(([source, destination]) => ({ source, destination, permanent: true }));
  },
};

module.exports = nextConfig;
