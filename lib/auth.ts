import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export interface SessionUser {
  id: string;
  email: string;
  profile: Profile;
}

/* Returns the signed-in user + profile (server-side), or null.
   Replaces Shell.guard()'s session restore from js/shell.js. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile || !profile.active) return null;

  return {
    id: user.id,
    email: user.email ?? profile.email ?? "",
    profile: {
      id: profile.id,
      name: profile.name,
      phone: profile.phone,
      email: profile.email,
      role: profile.role,
      active: profile.active,
      createdAt: new Date(profile.created_at).getTime(),
    },
  };
}
