"use server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, type ActionResult } from "./guard";

/* Create or update the signed-in user's review (one per user). */
export async function upsertReview(rating: number, text: string): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const clean = text.trim();
  if (!clean) return { ok: false, error: "Please write a comment." };
  const r = Math.max(1, Math.min(5, Math.round(rating)));

  const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
  const { data: existing } = await supabase.from("reviews").select("id").eq("user_id", user.id).maybeSingle();

  const { error } = await supabase.from("reviews").upsert(
    {
      user_id: user.id,
      name: profile?.name ?? "Member",
      rating: r,
      text: clean,
      status: "published",
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: "Could not save your review." };

  if (!existing) {
    await supabase.rpc("add_admin_notification", {
      p_msg: `New ${r}-star review from ${profile?.name ?? "a member"}.`,
      p_type: "info",
    });
  }
  return { ok: true };
}

export async function toggleReviewStatus(id: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = createClient();
  const { data: r } = await supabase.from("reviews").select("status").eq("id", id).single();
  if (!r) return { ok: false, error: "Review not found." };
  const { error } = await supabase
    .from("reviews")
    .update({ status: r.status === "published" ? "hidden" : "published" })
    .eq("id", id);
  return error ? { ok: false, error: "Update failed." } : { ok: true };
}

export async function deleteReview(id: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const supabase = createClient();
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  return error ? { ok: false, error: "Delete failed." } : { ok: true };
}
