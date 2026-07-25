"use client";
/* Standard footer — ported from Shell.renderFooter() in js/shell.js. */
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/reset" || pathname === "/confirm") return null; // auth pages have no footer
  const year = new Date().getFullYear();
  return (
    <div id="siteFooter">
      <footer className="footer">
        <span>© {year} J&apos;s Pickle Yard · Play • Connect • Compete</span>
      </footer>
    </div>
  );
}
