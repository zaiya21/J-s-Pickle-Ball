"use server";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/* Returns the signed-in user's id, or null. */
export async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/* Verifies the caller is an active admin. Server actions call this before any
   privileged write (defense-in-depth on top of the RLS admin policies). */
export async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: profile } = await supabase.from("profiles").select("role, active").eq("id", user.id).single();
  if (!profile || profile.role !== "admin" || !profile.active) return { ok: false, error: "Admins only." };
  return { ok: true, userId: user.id };
}
