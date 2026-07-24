import { type NextRequest } from "next/server";
// Relative import (not the "@/" alias): Vercel's Edge bundler does not resolve
// the tsconfig path alias for middleware, which fails the build otherwise.
import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all paths except static assets and image files, so the session
     * cookie stays fresh and protected routes are guarded.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|png|webp|svg|gif|ico|css|js)$).*)",
  ],
};
