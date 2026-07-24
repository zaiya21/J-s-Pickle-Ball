"use server";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./guard";

/* Mark all of the signed-in user's notifications as read. */
export async function markAllNotificationsRead(): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);
  return error ? { ok: false, error: "Update failed." } : { ok: true };
}

/* Send a message from the public Contacts form to all admins. */
export async function sendContactMessage(name: string, email: string, message: string): Promise<ActionResult> {
  const supabase = createClient();
  const clean = message.trim().slice(0, 200);
  if (!name.trim() || !clean) return { ok: false, error: "Please fill in the form." };
  const { error } = await supabase.rpc("add_admin_notification", {
    p_msg: `📨 Message from ${name.trim()} (${email.trim()}): "${clean}"`,
    p_type: "info",
  });
  return error ? { ok: false, error: "Could not send. Please try again." } : { ok: true };
}
