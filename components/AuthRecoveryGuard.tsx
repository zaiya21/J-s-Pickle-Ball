"use client";
/* Safety net: if Supabase falls back to the Site URL (home) instead of /reset,
   the password-recovery token arrives in the URL hash on the wrong page. Detect
   it anywhere and forward to /reset (preserving the hash) so the reset form can
   pick up the session. */
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function AuthRecoveryGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/reset") return;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash && hash.includes("type=recovery")) {
      router.replace("/reset" + hash);
    }
  }, [pathname, router]);

  return null;
}
