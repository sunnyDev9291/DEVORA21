"use client";

import { useEffect, useRef } from "react";

interface ResumeRawAiTextareaProps {
  value: string;
  streaming?: boolean;
  /** Optional label override */
  label?: string;
}

/** Live / completed AI response shown as a Claude-style chat message. */
export default function ResumeRawAiTextarea({
  value,
  streaming = false,
  label = "Claude",
}: ResumeRawAiTextareaProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [value, streaming]);

  const showTypingDots = streaming && !value.trim();
  const showCursor = streaming && Boolean(value.trim());

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 dark:border-white/[0.10] bg-white dark:bg-[#0f1115] overflow-hidden shadow-sm min-h-[320px] max-h-[520px]">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-white/[0.06] bg-orange-500/[0.06] dark:bg-orange-500/[0.08] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-rose-500 text-white text-xs font-bold shadow-sm"
            aria-hidden
          >
            C
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{label}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              claude-sonnet-4-6
              {streaming ? " · generating…" : value ? " · draft ready" : ""}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            streaming
              ? "bg-orange-500/15 text-orange-700 dark:text-orange-300"
              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {streaming ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              Live
            </>
          ) : (
            "Complete"
          )}
        </span>
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0 bg-slate-50/80 dark:bg-white/[0.02]"
        aria-live="polite"
        aria-busy={streaming}
      >
        <div className="flex justify-start">
          <div className="max-w-[95%] sm:max-w-[92%] rounded-2xl rounded-bl-md border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.06] px-4 py-3 text-sm leading-relaxed text-slate-800 dark:text-slate-200 shadow-sm">
            {showTypingDots ? (
              <span className="inline-flex items-center gap-1.5 text-slate-400" aria-label="Claude is typing">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
              </span>
            ) : (
              <p className="whitespace-pre-wrap break-words font-sans">
                {value}
                {showCursor ? (
                  <span
                    className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-orange-500 align-baseline animate-pulse"
                    aria-hidden
                  />
                ) : null}
              </p>
            )}
          </div>
        </div>

        {!streaming && value ? (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1">
            Structured fields below are filled from this response · {value.length.toLocaleString()}{" "}
            characters
          </p>
        ) : null}
      </div>
    </div>
  );
}
