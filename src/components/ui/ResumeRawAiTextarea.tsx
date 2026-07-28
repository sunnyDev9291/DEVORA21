"use client";

import { useEffect, useRef } from "react";

interface ResumeRawAiTextareaProps {
  value: string;
  streaming?: boolean;
  /** Optional label override */
  label?: string;
}

/** Live / completed plain-text AI response before structured fields are filled. */
export default function ResumeRawAiTextarea({
  value,
  streaming = false,
  label = "Raw AI response",
}: ResumeRawAiTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !streaming) return;
    el.scrollTop = el.scrollHeight;
  }, [value, streaming]);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/[0.10] bg-slate-950 dark:bg-black/50 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-white/10">
        <div>
          <p className="text-sm font-semibold text-slate-100">{label}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {streaming
              ? "Streaming from Claude — structured fields fill when this completes"
              : "Source text used to fill title, summary, skills, and experience"}
          </p>
        </div>
        <p className="text-[11px] text-slate-500 shrink-0">
          {streaming ? "Live" : "Complete"}
          {value ? ` · ${value.length.toLocaleString()} chars` : ""}
        </p>
      </div>
      <textarea
        ref={ref}
        readOnly
        value={value || (streaming ? "Connecting to stream…" : "")}
        aria-label={label}
        spellCheck={false}
        className="w-full min-h-[220px] max-h-[420px] resize-y bg-transparent px-4 py-3 text-[12px] leading-relaxed text-emerald-300/90 font-mono outline-none"
      />
    </div>
  );
}
