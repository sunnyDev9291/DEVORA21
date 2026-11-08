"use client";

import CopyIconButton from "@/components/ui/CopyIconButton";
import { isHttpJobUrl, JOB_URL_NOT_TRACKED, normalizeStoredJobUrl } from "@/lib/resume-job-url";

type JobUrlDisplayProps = {
  jobUrl?: string | null;
  className?: string;
  /** Kept for callers; unused now that URLs are copy-only. */
  linkClassName?: string;
};

/**
 * Job URL control: http(s) shows a copy button only (URL not visible).
 * "not tracked" (and any non-URL) shows as plain text.
 */
export default function JobUrlDisplay({ jobUrl, className = "" }: JobUrlDisplayProps) {
  const value = normalizeStoredJobUrl(jobUrl);

  if (!isHttpJobUrl(value)) {
    return (
      <span className={className} title={value === JOB_URL_NOT_TRACKED ? undefined : value}>
        {value}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center ${className}`.trim()}>
      <CopyIconButton
        text={value}
        label="Copy job URL"
        className="h-9 self-auto px-2.5"
      />
    </span>
  );
}
