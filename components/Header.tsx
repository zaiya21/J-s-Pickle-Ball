"use client";
/* Shared top bar — ported from Shell.renderHeader() in js/shell.js.
   Same markup/classes; active nav from usePathname; real Supabase logout;
   notifications are fetched server-side (Supabase) and passed in. */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "./session";
import { createClient } from "@/lib/supabase/client";
import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { initials, timeAgo } from "@/lib/helpers";
import type { Notification } from "@/lib/types";

const NAV: [string, string, string][] = [
  ["home", "/", "Home"],
  ["book", "/book", "Book"],
  ["mybookings", "/my-bookings", "My Bookings"],
  ["pricing", "/pricing", "Pricing"],
  ["events", "/events", "Events"],
  ["contacts", "/contacts", "Contacts"],
];

function keyForPath(path: string): string {
  if (path === "/") return "home";
  if (path.startsWith("/my-bookings")) return "mybookings";
  if (path.startsWith("/book")) return "book";
  if (path.startsWith("/pricing")) return "pricing";
  if (path.startsWith("/events")) return "events";
  if (path.startsWith("/contacts")) return "contacts";
  if (path.startsWith("/admin")) return "admin";
  return "";
}

export default function Header({ notifications = [] }: { notifications?: Notification[] }) {
  const user = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [localRead, setLocalRead] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // mobile hamburger menu

  // The auth pages render no header/footer (as login.html did).
  if (pathname === "/login" || pathname === "/reset") return null;

  const active = keyForPath(pathname);
  const nav = [...NAV];
  if (user && user.role === "admin") nav.push(["admin", "/admin", "Admin"]);

  const hasUnread = !localRead && notifications.some((n) => !n.read);

  const logout = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const markRead = async () => {
    setLocalRead(true);
    await markAllNotificationsRead();
    router.refresh();
  };

  const toggleBell = () => {
    const next = !drawerOpen;
    setDrawerOpen(next);
    if (next && hasUnread) markRead();
  };

  const shown = notifications.slice(0, 30);

  return (
    <div id="siteHeader">
      <header className="topbar">
        <Link className="brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Pickle Ball Logo.jpg" alt="J's Pickle Yard" className="brand-logo" />
          <span className="brand-name">
            J&apos;S <em>PICKLE YARD</em>
          </span>
        </Link>
        <nav className="mainnav">
          {nav.map(([key, href, label]) => (
            <Link key={key} className={`nav-link ${active === key ? "active" : ""}`} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        {/* Mobile-only hamburger (hidden on desktop via CSS) */}
        <button
          className="nav-toggle"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
        <div className="topbar-right">
          {user ? (
            <>
              <button id="bellBtn" className="icon-btn" title="Notifications" onClick={toggleBell}>
                🔔<span className={`bell-dot ${hasUnread ? "" : "hidden"}`}></span>
              </button>
              <Link className="user-chip" href="/profile" title="My profile">
                <span className="avatar">{initials(user.name)}</span>
                <span className="user-name">{user.name.split(" ")[0]}</span>
              </Link>
              <button className="btn ghost small-btn" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <Link className="btn primary small-btn" href="/login">
              Sign In
            </Link>
          )}
        </div>
        {/* Mobile-only dropdown menu (hidden on desktop via CSS) */}
        <nav className={`mobile-nav ${menuOpen ? "open" : ""}`}>
          {nav.map(([key, href, label]) => (
            <Link
              key={key}
              className={`nav-link ${active === key ? "active" : ""}`}
              href={href}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {user && (
        <div className={`notif-drawer ${drawerOpen ? "" : "hidden"}`}>
          <div className="notif-head">
            <strong>Notifications</strong>
            <button className="link-btn" onClick={markRead}>
              Mark all read
            </button>
          </div>
          <div className="notif-list">
            {shown.length === 0 ? (
              <div className="notif-empty">No notifications yet.</div>
            ) : (
              shown.map((n) => (
                <div key={n.id} className={`notif-item ${n.read || localRead ? "" : "unread"}`}>
                  {n.msg}
                  <span className="when">{timeAgo(n.at)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
