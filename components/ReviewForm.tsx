"use client";
/* Homepage review form island — ported from index.html's renderReviewForm,
   rewired to the upsertReview server action (Supabase). */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { useSession } from "@/components/session";
import { upsertReview } from "@/lib/actions/reviews";

export default function ReviewForm({
  existingRating,
  existingText,
}: {
  existingRating: number | null;
  existingText: string | null;
}) {
  const user = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const editing = existingText != null;
  const [rating, setRating] = useState(existingRating ?? 5);
  const [text, setText] = useState(existingText ?? "");
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <div className="card review-card">
        <p className="center muted">Played at the Yard? We&apos;d love to hear from you.</p>
        <p className="center" style={{ marginTop: ".6rem" }}>
          <Link className="btn primary" href="/login">
            Sign in to leave a review
          </Link>
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const res = await upsertReview(rating, text);
    setBusy(false);
    if (!res.ok) return toast(res.error || "Could not post review.", "error");
    toast("Thanks for your review!", "success");
    router.refresh();
  }

  return (
    <div className="card review-card">
      <h3 className="center">{editing ? "Edit your review" : "Leave a review"}</h3>
      <div className="star-picker center">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={`star-btn ${n <= rating ? "on" : ""}`} onClick={() => setRating(n)}>
            ★
          </button>
        ))}
      </div>
      <form onSubmit={submit}>
        <label>
          Your comment
          <textarea
            rows={3}
            maxLength={300}
            required
            placeholder="How was your game at J's Pickle Yard?"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="center">
          <button className="btn primary" type="submit" disabled={busy}>
            {editing ? "Update Review" : "Post Review"}
          </button>
        </div>
      </form>
    </div>
  );
}
