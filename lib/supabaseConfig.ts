/* Whether real Supabase credentials are wired in. Both vars are NEXT_PUBLIC so
   this is safe to evaluate on the client. Used to give a clear "not connected"
   message instead of a silent failure when the app runs on placeholder values. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const SUPABASE_CONFIGURED =
  Boolean(SUPABASE_URL) &&
  Boolean(SUPABASE_ANON_KEY) &&
  !SUPABASE_URL.includes("placeholder") &&
  !SUPABASE_ANON_KEY.includes("placeholder");

export const NOT_CONFIGURED_MSG =
  "This site isn't connected to Supabase yet, so real accounts and confirmation emails are disabled. Add your Supabase project keys to .env.local (locally) or the Vercel environment variables (in production).";
