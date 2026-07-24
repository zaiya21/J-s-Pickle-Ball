"use server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, type ActionResult } from "./guard";
import { fmtDateLong } from "@/lib/helpers";

export interface EventInput {
  id?: string | null;
  title: string;
  date: string;
  time: string;
  desc: string;
  photos: string[]; // already-uploaded storage URLs
}

export async function saveEvent(input: EventInput): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = createClient();
  const title = input.title.trim();
  const desc = input.desc.trim();
  if (!title || !input.date || !desc) return { ok: false, error: "Title, date, and details are required." };

  const row = { title, date: input.date, time: input.time.trim(), description: desc, photos: input.photos };

  if (input.id) {
    const { error } = await supabase.from("events").update(row).eq("id", input.id);
    return error ? { ok: false, error: "Could not update event." } : { ok: true };
  }

  const { error } = await supabase.from("events").insert(row);
  if (error) return { ok: false, error: "Could not post event." };
  await supabase.rpc("add_user_broadcast", {
    p_msg: `📣 New event: ${title} on ${fmtDateLong(input.date)} — check the Events page!`,
    p_type: "info",
  });
  return { ok: true };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  return error ? { ok: false, error: "Delete failed." } : { ok: true };
}
