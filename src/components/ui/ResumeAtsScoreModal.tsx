"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import ResumeContentReview from "@/components/sections/ResumeContentReview";
import ResumeImproveProgress from "@/components/ui/ResumeImproveProgress";
import ResumeThinkingProgress from "@/components/ui/ResumeThinkingProgress";
import { ResumeScorePanel, type ResumeScorePanelProps } from "@/components/ui/ResumeScorePanel";
import { ResumeScoringInstructionsPanel } from "@/components/ui/ResumeScoringInstructionsPanel";
import { RESUME_PASS_THRESHOLD } from "@/lib/resume-unified-score";
import type { GeneratedResumeContent } from "@/lib/resume-types";
import type { ResumeGenerationPhase } from "@/lib/resume-prompt";
import type { FeedbackResolution, ResumeFieldChange } from "@/lib/resume-content-diff";
import type { ResumeImproveTarget } from "@/lib/resume-improve-target";

interface ResumeAtsScoreModalProps extends ResumeScorePanelProps {
  open: boolean;
  onClose: () => void;
  jobTitle?: string;
  content?: GeneratedResumeContent | null;
  onContentChange?: (content: GeneratedResumeContent) => void;
  onApply?: () => void;
  applying?: boolean;
  generating?: boolean;
  streamPhase?: ResumeGenerationPhase;
  generateError?: string;
  regenerateNotice?: string;
  templateName?: string;
  customPrompt?: string;
  resumeFileBaseName?: string;
  suggestedResumeBaseName?: string;
  onResumeFileBaseNameChange?: (value: string, options?: { markTouched?: boolean }) => void;
  onResumeFileBaseNameReset?: () => void;
  applyLabel?: string;
  generationKey?: number;
  onOpenResumeChat?: () => void;
  regenerateChanges?: ResumeFieldChange[];
  regenerateFeedback?: FeedbackResolution | null;
  changedFieldIds?: Set<string>;
  onDismissRegenerateDiff?: () => void;
  onImprove?: (target: ResumeImproveTarget) => void;
  improvingTargetId?: string;
  improvingTargetLabel?: string;
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
  applying = false,
  generating = false,
  streamPhase = "starting",
  generateError = "",
  regenerateNotice = "",
  templateName = "",
  customPrompt = "",
  resumeFileBaseName = "",
  suggestedResumeBaseName = "",
  onResumeFileBaseNameChange,
  onResumeFileBaseNameReset,
  applyLabel,
  generationKey = 0,
  onOpenResumeChat,
  regenerateChanges = [],
  regenerateFeedback = null,
  changedFieldIds,
  onDismissRegenerateDiff,
  onImprove,
  improvingTargetId,
  improvingTargetLabel,
}: ResumeAtsScoreModalProps) {
  const showContentReview = !!content && !!onContentChange && !!onApply;
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
              {showContentReview ? "Review draft & score" : "Resume score report"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {jobTitle ? `Target: ${jobTitle}` : `Combined ATS + rules · ${RESUME_PASS_THRESHOLD}%+ to pass`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-white transition-colors"
            aria-label="Close score report"
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
            <ResumeScoringInstructionsPanel customPrompt={customPrompt} defaultExpanded={Boolean(customPrompt.trim())} />
            <ResumeScorePanel
              score={score}
              loading={loading}
              error={error}
              onRecheck={onRecheck}
              recheckDisabled={recheckDisabled}
              customPrompt={customPrompt}
              onImprove={onImprove}
              improvingTargetId={improvingTargetId}
            />
          </div>

          {showContentReview && (
            <div className="relative min-h-0 overflow-y-auto overscroll-contain order-1 lg:order-2">
              {generating && (
                <div className="sticky top-0 z-10 border-b border-blue-500/20 bg-blue-500/[0.04] dark:bg-blue-500/[0.06]">
                  {improvingTargetId ? (
                    <ResumeImproveProgress
                      phase={streamPhase}
                      targetLabel={improvingTargetLabel}
                    />
                  ) : (
                    <ResumeThinkingProgress phase={streamPhase} jobTitle={jobTitle ?? ""} embedded />
                  )}
                </div>
              )}
              {generateError && (
                <div className="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-3 py-2.5">
                  <p className="text-xs text-red-600 dark:text-red-300">{generateError}</p>
                </div>
              )}
              {regenerateNotice && (
                <div className="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2.5">
                  <p className="text-xs text-amber-800 dark:text-amber-200">{regenerateNotice}</p>
                </div>
              )}
              <div className={`p-4 sm:p-5 ${generating ? "pointer-events-none opacity-60" : ""}`}>
                <ResumeContentReview
                  content={content}
                  onChange={onContentChange}
                  onApply={onApply}
                  applying={applying}
                  generating={generating}
                  templateName={templateName}
                  resumeFileBaseName={resumeFileBaseName}
                  suggestedResumeBaseName={suggestedResumeBaseName}
                  onResumeFileBaseNameChange={onResumeFileBaseNameChange ?? (() => {})}
                  onResumeFileBaseNameReset={onResumeFileBaseNameReset}
                  applyLabel={applyLabel}
                  generationKey={generationKey}
                  embedded
                  regenerateChanges={regenerateChanges}
                  regenerateFeedback={regenerateFeedback}
                  changedFieldIds={changedFieldIds}
                  onDismissRegenerateDiff={onDismissRegenerateDiff}
                />
              </div>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 dark:border-white/[0.08] bg-white/95 dark:bg-navy-900/95 px-5 py-3 backdrop-blur-sm">
          {onOpenResumeChat && content && (
            <button
              type="button"
              onClick={onOpenResumeChat}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-500/15 transition-all mr-auto"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Application Q&A
            </button>
          )}
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
