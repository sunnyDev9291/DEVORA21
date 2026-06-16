"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import ResumeContentReview from "@/components/sections/ResumeContentReview";
import ResumeThinkingProgress from "@/components/ui/ResumeThinkingProgress";
import { ResumeAtsScorePanel, type ResumeAtsScorePanelProps } from "@/components/ui/ResumeAtsScorePanel";
import { ATS_PASS_THRESHOLD } from "@/lib/resume-ats";
import type { GeneratedResumeContent } from "@/lib/resume-types";
import type { ResumeGenerationPhase } from "@/lib/resume-prompt";

interface ResumeAtsScoreModalProps extends ResumeAtsScorePanelProps {
  open: boolean;
  onClose: () => void;
  jobTitle?: string;
  content?: GeneratedResumeContent | null;
  onContentChange?: (content: GeneratedResumeContent) => void;
  onApply?: () => void;
  onRegenerate?: () => void;
  applying?: boolean;
  generating?: boolean;
  streamPhase?: ResumeGenerationPhase;
  generateError?: string;
  templateName?: string;
  applyLabel?: string;
  generationKey?: number;
}

export default function ResumeAtsScoreModal({
  open,
  onClose,
  jobTitle,
  score,
  loading,
  error,
  onRecheck,
  recheckDisabled,
  content,
  onContentChange,
  onApply,
  onRegenerate,
  applying = false,
  generating = false,
  streamPhase = "starting",
  generateError = "",
  templateName = "",
  applyLabel,
  generationKey = 0,
}: ResumeAtsScoreModalProps) {
  const showContentReview = !!content && !!onContentChange && !!onApply && !!onRegenerate;
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
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex h-full w-full items-center justify-center p-4 sm:p-6 pointer-events-none"
      style={{ height: "100dvh", width: "100vw" }}
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-slate-950/45 dark:bg-black/55 backdrop-blur-md animate-backdrop-enter pointer-events-auto"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`relative z-10 flex w-full ${
          showContentReview ? "max-w-7xl" : "max-w-2xl"
        } max-h-[min(92dvh,900px)] flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-white/[0.10] bg-white dark:bg-navy-900 shadow-2xl shadow-black/30 animate-dialog-enter pointer-events-auto`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 dark:border-white/[0.08] bg-gradient-to-r from-violet-500/[0.08] to-indigo-500/[0.05] dark:from-violet-500/[0.12] dark:to-indigo-500/[0.08] px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/20">
            <svg className="h-5 w-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-bold text-slate-900 dark:text-white truncate">
              {showContentReview ? "Review draft & ATS score" : "ATS Score Report"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {jobTitle ? `Target: ${jobTitle}` : `Strict evaluation · ${ATS_PASS_THRESHOLD}% pass threshold`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-white transition-colors"
            aria-label="Close ATS report"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div
          className={`flex-1 min-h-0 overscroll-contain ${
            showContentReview
              ? "grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:divide-x lg:divide-slate-200 lg:dark:divide-white/[0.08]"
              : "overflow-y-auto"
          }`}
        >
          <div className="min-h-0 overflow-y-auto overscroll-contain order-2 lg:order-1 border-t lg:border-t-0 border-slate-200 dark:border-white/[0.08]">
            <ResumeAtsScorePanel
              score={score}
              loading={loading}
              error={error}
              onRecheck={onRecheck}
              recheckDisabled={recheckDisabled}
            />
          </div>

          {showContentReview && (
            <div className="relative min-h-0 overflow-y-auto overscroll-contain order-1 lg:order-2">
              {generating && (
                <div className="sticky top-0 z-10 border-b border-blue-500/20 bg-blue-500/[0.06] px-4 py-3">
                  <ResumeThinkingProgress phase={streamPhase} jobTitle={jobTitle ?? ""} />
                </div>
              )}
              {generateError && (
                <div className="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-3 py-2.5">
                  <p className="text-xs text-red-600 dark:text-red-300">{generateError}</p>
                </div>
              )}
              <div className={`p-4 sm:p-5 ${generating ? "pointer-events-none opacity-60" : ""}`}>
                <ResumeContentReview
                  content={content}
                  onChange={onContentChange}
                  onApply={onApply}
                  onRegenerate={onRegenerate}
                  applying={applying}
                  generating={generating}
                  templateName={templateName}
                  jobTitle={jobTitle}
                  applyLabel={applyLabel}
                  generationKey={generationKey}
                  embedded
                />
              </div>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 dark:border-white/[0.08] bg-white/95 dark:bg-navy-900/95 px-5 py-3 backdrop-blur-sm">
          {onRecheck && score && !loading && (
            <button
              type="button"
              onClick={onRecheck}
              disabled={recheckDisabled}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-50 transition-all"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Re-check
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-all"
          >
            {score?.passed ? "Continue editing" : "Close & improve"}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
