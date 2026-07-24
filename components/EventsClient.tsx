"use client";
/* Tournaments & Events — ported from events.html/js/events.js, rewired to
   Supabase. Events come from the server; admin create/edit/delete go through
   server actions; photos upload to the media bucket. */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { saveEvent, deleteEvent } from "@/lib/actions/events";
import { fmtDateLong, todayStr } from "@/lib/helpers";
import type { EventRec } from "@/lib/types";

const MAX_PHOTOS = 5;

export default function EventsClient({ events, isAdmin }: { events: EventRec[]; isAdmin: boolean }) {
  const router = useRouter();
  const { toast, confirm } = useToast();
  const supabase = createClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<{ photos: string[]; idx: number; title: string } | null>(null);
  const formCard = useRef<HTMLDivElement>(null);

  const today = todayStr();
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));

  async function addPhotos(files: File[]) {
    const next = [...photos];
    for (const f of files) {
      if (next.length >= MAX_PHOTOS) {
        toast(`Maximum of ${MAX_PHOTOS} photos per event.`, "warn");
        break;
      }
      if (!f.type.startsWith("image/")) continue;
      const path = `events/${crypto.randomUUID()}-${f.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error } = await supabase.storage.from("media").upload(path, f, { upsert: true });
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
    setTime("");
    setDesc("");
  }

  function startEdit(ev: EventRec) {
    setEditingId(ev.id);
    setPhotos(ev.photos.slice());
    setTitle(ev.title);
    setDate(ev.date);
    setTime(ev.time || "");
    setDesc(ev.desc);
    formCard.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await saveEvent({ id: editingId, title, date, time, desc, photos });
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

  function EventCard({ ev, isPast }: { ev: EventRec; isPast: boolean }) {
    return (
      <div className={`card event-card ${isPast ? "past-event" : ""}`}>
        <div className="event-top">
          <div>
            <div className="event-title">{ev.title}</div>
            <div className="event-when">
              📅 {fmtDateLong(ev.date)}
              {ev.time ? ` · 🕗 ${ev.time}` : ""}{" "}
              {isPast ? (
                <span className="badge completed" style={{ marginLeft: ".4rem" }}>done</span>
              ) : (
                <span className="badge confirmed" style={{ marginLeft: ".4rem" }}>upcoming</span>
              )}
            </div>
          </div>
          {isAdmin && (
            <div className="row gap">
              <button className="mini-btn" onClick={() => startEdit(ev)}>Edit</button>
              <button className="mini-btn danger" onClick={() => remove(ev)}>Delete</button>
            </div>
          )}
        </div>
        <p className="event-desc">{ev.desc}</p>
        {ev.photos && ev.photos.length > 0 && (
          <div className="event-photos">
            {ev.photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={p}
                alt={`${ev.title} photo ${i + 1}`}
                onClick={() => setLightbox({ photos: ev.photos, idx: i, title: ev.title })}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="page-wrap">
      <div className="page-head">
        <h1>Tournaments &amp; Events</h1>
        <p className="muted">Open plays, clinics, and monthly tournaments at the Yard — check what&apos;s coming up.</p>
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
            <label>
              Time / schedule <span className="muted small">(optional)</span>
              <input type="text" maxLength={60} placeholder="8:00 AM – 5:00 PM" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
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
            No events posted yet — watch this space for tournaments, clinics, and open-play nights! 🏆
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <div className="event-divider">Upcoming</div>
                {upcoming.map((ev) => (
                  <EventCard key={ev.id} ev={ev} isPast={false} />
                ))}
              </>
            )}
            {past.length > 0 && (
              <>
                <div className="event-divider">Past events</div>
                {past.map((ev) => (
                  <EventCard key={ev.id} ev={ev} isPast={true} />
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
