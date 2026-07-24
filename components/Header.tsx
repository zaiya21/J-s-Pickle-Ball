"use client";
/* Shared top bar — ported from Shell.renderHeader() in js/shell.js.
   Same markup/classes; active nav from usePathname; real Supabase logout;
   notifications read from the client model (clientDb) for phase 1. */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "./session";
import { createClient } from "@/lib/supabase/client";
import { DB } from "@/lib/clientDb";
import { initials, timeAgo } from "@/lib/helpers";

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

interface Notif {
  id: string;
  userId: string;
  msg: string;
  read: boolean;
  at: number;
}

export default function Header() {
  const user = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [hasUnread, setHasUnread] = useState(false);

  const loadNotifs = () => {
    if (!user) return;
    DB.load();
    const mine = (DB.data!.notifications as Notif[]).filter((n) => n.userId === user.id);
    setNotifs(mine);
    setHasUnread(mine.some((n) => !n.read));
  };

  useEffect(() => {
    loadNotifs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // The auth pages render no header/footer (as login.html did).
  if (pathname === "/login" || pathname === "/reset") return null;

  const active = keyForPath(pathname);
  const nav = [...NAV];
  if (user && user.role === "admin") nav.push(["admin", "/admin", "Admin"]);

  const logout = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const toggleBell = () => {
    const next = !drawerOpen;
    setDrawerOpen(next);
    if (next) {
      // opening marks the shown items read (as in Shell.renderNotifications)
      DB.load();
      const items = (DB.data!.notifications as Notif[])
        .filter((n) => n.userId === user!.id)
        .slice(0, 30);
      items.forEach((n) => (n.read = true));
      DB.save();
      setHasUnread(false);
      setNotifs((DB.data!.notifications as Notif[]).filter((n) => n.userId === user!.id));
    }
  };

  const markAll = () => {
    DB.load();
    (DB.data!.notifications as Notif[]).forEach((n) => {
      if (n.userId === user!.id) n.read = true;
    });
    DB.save();
    loadNotifs();
  };

  const shown = notifs.slice(0, 30);

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
      </header>

      {user && (
        <div className={`notif-drawer ${drawerOpen ? "" : "hidden"}`}>
          <div className="notif-head">
            <strong>Notifications</strong>
            <button className="link-btn" onClick={markAll}>
              Mark all read
            </button>
          </div>
          <div className="notif-list">
            {shown.length === 0 ? (
              <div className="notif-empty">No notifications yet.</div>
            ) : (
              shown.map((n) => (
                <div key={n.id} className={`notif-item ${n.read ? "" : "unread"}`}>
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
