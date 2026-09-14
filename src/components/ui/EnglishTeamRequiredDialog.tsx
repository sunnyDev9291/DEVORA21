"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Button from "@/components/ui/Button";
import CopyIconButton from "@/components/ui/CopyIconButton";
import { ENGLISH_TEAM_REQUIRED_MESSAGE } from "@/lib/english-team-gate";

const Modal = dynamic(() => import("@/components/ui/Modal"), { ssr: false });

type EnglishTeamRequiredDialogProps = {
  open: boolean;
  message?: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  /** Run Job Check for the current job. */
  onJobCheck?: () => void;
  /** Bypass the English-team block and continue resume generation. */
  onContinueCreating?: () => void;
  continuing?: boolean;
  onClose: () => void;
};

export default function EnglishTeamRequiredDialog({
  open,
  message,
  jobTitle = "",
  companyName = "",
  jobDescription = "",
  onJobCheck,
  onContinueCreating,
  continuing = false,
  onClose,
}: EnglishTeamRequiredDialogProps) {
  const [jdOpen, setJdOpen] = useState(false);
  const text = message?.trim() || ENGLISH_TEAM_REQUIRED_MESSAGE;
  const description = jobDescription.trim();
  const jdTitle =
    [jobTitle.trim(), companyName.trim()].filter(Boolean).join(" · ") || "Job description";

  useEffect(() => {
    if (!open) setJdOpen(false);
  }, [open]);

  return (
    <>
      <Modal open={open} onClose={onClose} title="English team required" priority>
        <div className="space-y-4 p-5">
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3">
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
            <p className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap">{text}</p>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Resume generation was not started. You can run Job Check, review the job description,
            continue anyway, or close this dialog.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={continuing}>
              OK
            </Button>
            {onJobCheck ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onJobCheck}
                disabled={continuing}
              >
                Job check
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setJdOpen(true)}
              disabled={continuing}
            >
              View JD
            </Button>
            {onContinueCreating ? (
              <Button
                type="button"
                size="sm"
                onClick={onContinueCreating}
                disabled={continuing}
              >
                {continuing ? "Continuing…" : "Continue creating"}
              </Button>
            ) : null}
          </div>
        </div>
      </Modal>

      <Modal
        open={open && jdOpen}
        onClose={() => setJdOpen(false)}
        title={jdTitle}
        priority
        className="max-w-2xl"
      >
        <div className="overflow-y-auto px-6 py-5 max-h-[min(70dvh,32rem)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Job description
            </p>
            <CopyIconButton
              text={description}
              label="Copy job description"
              className="h-10 self-auto"
              disabled={!description}
            />
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {description || "No job description is available for this job yet."}
          </div>
          <div className="mt-5 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setJdOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
