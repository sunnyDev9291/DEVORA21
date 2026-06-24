"use client";

import { RESUME_ACCESS_NOTICE, RESUME_BUILDER_ACCESS_MESSAGE } from "@/lib/resume-access";

interface ResumeAccessNoticeProps {
  notice: string | null;
}

export default function ResumeAccessNotice({ notice }: ResumeAccessNoticeProps) {
  if (notice !== RESUME_ACCESS_NOTICE) return null;

  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
      role="status"
    >
      {RESUME_BUILDER_ACCESS_MESSAGE}
    </div>
  );
}
