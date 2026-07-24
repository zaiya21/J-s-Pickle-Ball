"use client";
/* Ports toast(), confirmDialog(), and showImageOverlay() from js/shell.js into
   a React context, keeping identical markup/classes so styles.css applies. */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastType = "info" | "success" | "error" | "warn";
interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
  leaving: boolean;
}
interface ConfirmState {
  title: string;
  msg: string;
  yesLabel: string;
  resolve: (v: boolean) => void;
}

interface ToastApi {
  toast: (msg: string, type?: ToastType) => void;
  confirm: (title: string, msg: string, yesLabel?: string) => Promise<boolean>;
  showImage: (src: string, alt?: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [image, setImage] = useState<{ src: string; alt: string } | null>(null);
  const seq = useRef(0);

  const toast = useCallback((msg: string, type: ToastType = "info") => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, msg, type, leaving: false }]);
    // mirror the 3600ms visible + .3s fade from js/shell.js
    setTimeout(() => {
      setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 320);
    }, 3600);
  }, []);

  const confirm = useCallback(
    (title: string, msg: string, yesLabel = "Confirm") =>
      new Promise<boolean>((resolve) => setConfirmState({ title, msg, yesLabel, resolve })),
    [],
  );

  const showImage = useCallback((src: string, alt = "image") => setImage({ src, alt }), []);

  const closeConfirm = (v: boolean) => {
    confirmState?.resolve(v);
    setConfirmState(null);
  };

  return (
    <Ctx.Provider value={{ toast, confirm, showImage }}>
      {children}

      <div id="toastWrap" className="toast-wrap">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${t.type}`}
            style={t.leaving ? { opacity: 0, transition: "opacity .3s" } : undefined}
          >
            {t.msg}
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeConfirm(false)}>
          <div className="modal">
            <h3>{confirmState.title}</h3>
            <p className="muted">{confirmState.msg}</p>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => closeConfirm(false)}>
                Cancel
              </button>
              <button className="btn danger" onClick={() => closeConfirm(true)}>
                {confirmState.yesLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {image && (
        <div className="lightbox" onClick={(e) => e.target === e.currentTarget && setImage(null)}>
          <button className="lb-close" title="Close" onClick={() => setImage(null)}>
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.src} alt={image.alt} />
        </div>
      )}
    </Ctx.Provider>
  );
}
