"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  ariaLabel?: string;
  children: React.ReactNode;
  /** Centered overlay (default) or bottom-right panel for chat-style dialogs. */
  variant?: "center" | "panel";
  /** Vertical placement when variant is center. */
  align?: "center" | "top";
  /** Render above other app modals (e.g. resume review panel). */
  priority?: boolean;
  className?: string;
}

export default function Modal({
  open,
  onClose,
  title,
  ariaLabel,
  children,
  variant = "center",
  align = "center",
  priority = false,
  className = "",
}: ModalProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const overlayZ = priority ? "z-[10000]" : "z-[110]";

  const overlay = variant === "panel" ? (
    <div
      className={`fixed inset-0 ${overlayZ} pointer-events-none`}
      style={{ height: "100dvh", width: "100vw" }}
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/20 dark:bg-black/40 pointer-events-auto sm:bg-transparent sm:dark:bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={ariaLabel}
        className={`pointer-events-auto fixed bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] max-w-[400px] h-[min(560px,calc(100dvh-7rem))] bg-white dark:bg-warm-900 border border-slate-200 dark:border-white/[0.10] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-up ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/[0.08] shrink-0">
          <h2 id={titleId} className="text-sm font-bold text-slate-900 dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  ) : (
    <div
      className={`fixed inset-0 ${overlayZ} flex justify-center p-4 sm:p-6 ${
        align === "top" ? "items-start pt-20 sm:pt-24" : "items-center"
      } pointer-events-none`}
      style={{ height: "100dvh", width: "100vw" }}
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={ariaLabel}
        className={`relative z-10 w-full bg-white dark:bg-warm-900 border border-slate-200 dark:border-white/[0.10] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[min(90dvh,calc(100dvh-6rem))] pointer-events-auto animate-dialog-enter ${className || "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/[0.08] shrink-0">
          <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
