"use client";
/* Safety net: if Supabase ever drops an auth token on the wrong page (e.g. it
   falls back to the Site URL / home instead of /reset or /confirm), detect the
   token anywhere and forward to the correct landing page, preserving the token
   in the hash or query so that page can complete the flow. */
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function AuthRecoveryGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/reset" || pathname === "/confirm") return;
    if (typeof window === "undefined") return;

    const hash = window.location.hash; // e.g. "#access_token=...&type=recovery"
    const search = window.location.search; // e.g. "?token_hash=...&type=signup"
    const blob = hash + search;
    const suffix = hash.length > 1 ? hash : search; // carry whichever holds the token

    if (/[?&#]type=recovery/.test(blob)) {
      router.replace("/reset" + suffix);
    } else if (/[?&#]type=signup/.test(blob)) {
      router.replace("/confirm" + suffix);
    }
  }, [pathname, router]);

  return null;
}
