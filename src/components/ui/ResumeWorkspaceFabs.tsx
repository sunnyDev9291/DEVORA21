"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

export type ResumeWorkspaceFabActions = {
  showClear: boolean;
  clearDisabled?: boolean;
  onClear: () => void;
  showChat: boolean;
  chatDisabled?: boolean;
  onOpenChat: () => void;
};

interface ResumeWorkspaceFabsProps {
  actions: ResumeWorkspaceFabActions | null;
}

export default function ResumeWorkspaceFabs({ actions }: ResumeWorkspaceFabsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !actions) return null;
  if (!actions.showClear && !actions.showChat) return null;

  return createPortal(
    <div className="pointer-events-none fixed bottom-6 right-6 z-[101] flex flex-col-reverse items-end gap-3">
      {actions.showClear ? (
        <button
          type="button"
          onClick={actions.onClear}
          disabled={actions.clearDisabled}
          className="pointer-events-auto flex h-12 items-center gap-2.5 rounded-full bg-orange-600 pl-4 pr-5 text-sm font-semibold text-white shadow-xl shadow-orange-500/30 transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:bg-orange-500 hover:shadow-orange-500/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:scale-100"
          aria-label="Clear resume workspace"
        >
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear
        </button>
      ) : null}

      {actions.showChat ? (
        <button
          type="button"
          onClick={actions.onOpenChat}
          disabled={actions.chatDisabled}
          className="pointer-events-auto flex h-11 items-center gap-2 rounded-full bg-orange-600 pl-3.5 pr-4 text-sm font-semibold text-white shadow-xl shadow-violet-600/30 transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:bg-orange-500 hover:shadow-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:scale-100"
          aria-label="Open Application Q&A"
        >
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          Application Q&A
        </button>
      ) : null}
    </div>,
    document.body
  );
}
