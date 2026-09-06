"use client";

import dynamic from "next/dynamic";
import Button from "@/components/ui/Button";
import { ENGLISH_TEAM_REQUIRED_MESSAGE } from "@/lib/english-team-gate";

const Modal = dynamic(() => import("@/components/ui/Modal"), { ssr: false });

type EnglishTeamRequiredDialogProps = {
  open: boolean;
  message?: string;
  onClose: () => void;
};

export default function EnglishTeamRequiredDialog({
  open,
  message,
  onClose,
}: EnglishTeamRequiredDialogProps) {
  const text = message?.trim() || ENGLISH_TEAM_REQUIRED_MESSAGE;

  return (
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
          Resume generation was not started. Choose a role that works with an English / US / global
          team, or update the job details and try again.
        </p>
        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </Modal>
  );
}
