"use client";
/* Tournaments & Events — ported from events.html/js/events.js, rewired to
   Supabase. Events come from the server; admin create/edit/delete go through
   server actions; photos upload to the media bucket. */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { saveEvent, deleteEvent } from "@/lib/actions/events";
import { fmtDateLong, manilaTodayStr, compressImage } from "@/lib/helpers";
import type { EventRec } from "@/lib/types";

const MAX_PHOTOS = 5;

type Status = "happening" | "upcoming" | "finished";

/* "HH:MM[:SS]" (24h) → "h:mm AM/PM" for display. */
function fmtClock(t: string): string {
  if (!t) return "";
  const [hh, mm] = t.split(":");
  let h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mm} ${ampm}`;
}

/* Venue-time (Asia/Manila, +08:00) status of an event. */
function eventStatus(ev: EventRec): Status {
  const now = Date.now();
  const mk = (t: string) => new Date(`${ev.date}T${t.length === 5 ? t + ":00" : t}+08:00`).getTime();
  const start = ev.startTime ? mk(ev.startTime) : null;
  const end = ev.endTime ? mk(ev.endTime) : null;
  if (start != null && end != null) {
    if (now < start) return "upcoming";
    if (now > end) return "finished";
    return "happening";
  }
  if (start != null) {
    if (now < start) return "upcoming";
    return now <= new Date(`${ev.date}T23:59:59+08:00`).getTime() ? "happening" : "finished";
  }
  const today = manilaTodayStr();
  if (ev.date > today) return "upcoming";
  if (ev.date < today) return "finished";
  return "happening";
}

export default function EventsClient({ events, isAdmin }: { events: EventRec[]; isAdmin: boolean }) {
  const router = useRouter();
  const { toast, confirm } = useToast();
  const supabase = createClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0); // re-render each minute so status stays live
  const [lightbox, setLightbox] = useState<{ photos: string[]; idx: number; title: string } | null>(null);
  const formCard = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const ranked = events.map((e) => ({ ev: e, status: eventStatus(e) }));
  const key = (e: EventRec) => e.date + (e.startTime || "99:99");
  const happening = ranked.filter((r) => r.status === "happening").sort((a, b) => key(a.ev).localeCompare(key(b.ev)));
  const upcoming = ranked.filter((r) => r.status === "upcoming").sort((a, b) => key(a.ev).localeCompare(key(b.ev)));
  const finished = ranked.filter((r) => r.status === "finished").sort((a, b) => key(b.ev).localeCompare(key(a.ev)));

  async function addPhotos(files: File[]) {
    const next = [...photos];
    for (const f of files) {
      if (next.length >= MAX_PHOTOS) {
        toast(`Maximum of ${MAX_PHOTOS} photos per event.`, "warn");
        break;
      }
      if (!f.type.startsWith("image/")) continue;
      let body: Blob = f;
      try {
        body = await compressImage(f);
      } catch {
        /* keep original on failure */
      }
      const path = `events/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("media").upload(path, body, { upsert: true, contentType: "image/jpeg" });
      if (error) {
        toast(`Couldn't upload "${f.name}".`, "error");
        continue;
      }
      next.push(supabase.storage.from("media").getPublicUrl(path).data.publicUrl);
    }
    setPhotos(next);
  }

  function resetForm() {
    setEditingId(null);
    setPhotos([]);
    setTitle("");
    setDate("");
    setStartTime("");
    setEndTime("");
    setDesc("");
  }

  function startEdit(ev: EventRec) {
    setEditingId(ev.id);
    setPhotos(ev.photos.slice());
    setTitle(ev.title);
    setDate(ev.date);
    setStartTime(ev.startTime || "");
    setEndTime(ev.endTime || "");
    setDesc(ev.desc);
    formCard.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (startTime && endTime && endTime <= startTime) {
      return toast("End time must be after the start time.", "error");
    }
    setBusy(true);
    const res = await saveEvent({ id: editingId, title, date, time: "", startTime, endTime, desc, photos });
    setBusy(false);
    if (!res.ok) return toast(res.error || "Could not save event.", "error");
    toast(editingId ? "Event updated." : "Event posted!", "success");
    resetForm();
    router.refresh();
  }

  async function remove(ev: EventRec) {
    const ok = await confirm("Delete event?", `"${ev.title}" and its photos will be permanently removed.`, "Delete");
    if (!ok) return;
    const res = await deleteEvent(ev.id);
    if (!res.ok) return toast(res.error || "Delete failed.", "error");
    if (editingId === ev.id) resetForm();
    toast("Event deleted.", "success");
    router.refresh();
  }

  function EventCard({ ev, status }: { ev: EventRec; status: Status }) {
    const cover = ev.photos && ev.photos.length ? ev.photos[0] : null;
    const rest = ev.photos ? ev.photos.slice(1) : [];
    const badge =
      status === "happening"
        ? { cls: "happening", label: "Happening now" }
        : status === "upcoming"
          ? { cls: "live", label: "Upcoming" }
          : { cls: "done", label: "Finished" };
    const timeLabel = ev.startTime
      ? `${fmtClock(ev.startTime)}${ev.endTime ? " – " + fmtClock(ev.endTime) : ""}`
      : ev.time || "";
    return (
      <article className={`news-card ${status === "finished" ? "past-event" : ""}`}>
        <div
          className={`news-cover ${cover ? "" : "no-photo"}`}
          style={cover ? { backgroundImage: `url("${cover}")` } : undefined}
          onClick={cover ? () => setLightbox({ photos: ev.photos, idx: 0, title: ev.title }) : undefined}
        >
          {!cover && <span className="news-cover-ico">{ev.title.charAt(0).toUpperCase()}</span>}
          <div className="news-cover-top">
            <span className={`news-badge ${badge.cls}`}>{badge.label}</span>
            {isAdmin && (
              <div className="news-admin row gap" onClick={(e) => e.stopPropagation()}>
                <button className="mini-btn" onClick={() => startEdit(ev)}>Edit</button>
                <button className="mini-btn danger" onClick={() => remove(ev)}>Delete</button>
              </div>
            )}
          </div>
          <div className="news-cover-date">
            {fmtDateLong(ev.date)}
            {timeLabel ? ` · ${timeLabel}` : ""}
          </div>
        </div>
        <div className="news-body">
          <h3 className="news-title">{ev.title}</h3>
          <p className="news-desc">{ev.desc}</p>
          {rest.length > 0 && (
            <div className="news-thumbs">
              {rest.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={p}
                  alt={`${ev.title} photo ${i + 2}`}
                  onClick={() => setLightbox({ photos: ev.photos, idx: i + 1, title: ev.title })}
                />
              ))}
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <main className="page-wrap">
      <div className="page-head">
        <h1>Events &amp; News</h1>
        <p className="muted">Tournaments, open-play nights, clinics, and the latest from the Yard — here&apos;s what&apos;s happening.</p>
      </div>

      {isAdmin && (
        <div className="card" ref={formCard}>
          <h3>{editingId ? "Edit event" : "Post an event"}</h3>
          <form onSubmit={save}>
            <div className="grid-2" style={{ marginBottom: 0 }}>
              <label>
                Event title
                <input type="text" maxLength={80} required placeholder="Monthly Doubles Tournament" value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label>
                Date
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
            </div>
            <div className="grid-2" style={{ marginBottom: 0 }}>
              <label>
                Start time <span className="muted small">(optional)</span>
                <input type="time" step="1" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </label>
              <label>
                End time <span className="muted small">(optional)</span>
                <input type="time" step="1" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </label>
            </div>
            <label>
              Details
              <textarea rows={4} maxLength={1500} required placeholder="Format, divisions, entry fee, prizes, how to register…" value={desc} onChange={(e) => setDesc(e.target.value)} />
            </label>
            <label>
              Photos{" "}
              <span className="photo-count">
                (<span>{photos.length}</span>/5 · JPG or PNG, auto-compressed)
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  addPhotos(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
            </label>
            <div className="upload-previews">
              {photos.map((p, i) => (
                <div className="upload-thumb" key={i}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt={`Photo ${i + 1}`} />
                  <button type="button" className="rm" title="Remove" onClick={() => setPhotos((prev) => prev.filter((_, k) => k !== i))}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="row gap">
              <button className="btn primary" type="submit" disabled={busy}>
                {editingId ? "Save Changes" : "Post Event"}
              </button>
              {editingId && (
                <button className="btn ghost" type="button" onClick={resetForm}>
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="event-list" style={{ marginTop: "1rem" }}>
        {events.length === 0 ? (
          <div className="empty-state">
            No events posted yet — watch this space for tournaments, clinics, and open-play nights.
          </div>
        ) : (
          <>
            {happening.length > 0 && (
              <>
                <div className="event-divider">Happening now</div>
                {happening.map((r) => (
                  <EventCard key={r.ev.id} ev={r.ev} status={r.status} />
                ))}
              </>
            )}
            {upcoming.length > 0 && (
              <>
                <div className="event-divider">Upcoming</div>
                {upcoming.map((r) => (
                  <EventCard key={r.ev.id} ev={r.ev} status={r.status} />
                ))}
              </>
            )}
            {finished.length > 0 && (
              <>
                <div className="event-divider">Past events</div>
                {finished.map((r) => (
                  <EventCard key={r.ev.id} ev={r.ev} status={r.status} />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {lightbox && (
        <div
          className="lightbox"
          onClick={(e) => {
            const t = e.target as HTMLElement;
            if (t.classList.contains("lb-close") || t === e.currentTarget) setLightbox(null);
            else if (t.classList.contains("lb-prev"))
              setLightbox((lb) => lb && { ...lb, idx: (lb.idx - 1 + lb.photos.length) % lb.photos.length });
            else if (t.classList.contains("lb-next"))
              setLightbox((lb) => lb && { ...lb, idx: (lb.idx + 1) % lb.photos.length });
          }}
        >
          <button className="lb-close" title="Close">✕</button>
          {lightbox.photos.length > 1 && <button className="lb-nav lb-prev" title="Previous">‹</button>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.photos[lightbox.idx]} alt={`${lightbox.title} photo ${lightbox.idx + 1}`} />
          {lightbox.photos.length > 1 && <button className="lb-nav lb-next" title="Next">›</button>}
        </div>
      )}
    </main>
  );
}
