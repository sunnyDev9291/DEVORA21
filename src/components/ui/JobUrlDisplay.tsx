import { isHttpJobUrl, JOB_URL_NOT_TRACKED, normalizeStoredJobUrl } from "@/lib/resume-job-url";

type JobUrlDisplayProps = {
  jobUrl?: string | null;
  className?: string;
  /** Extra classes for the link when jobUrl is http(s). */
  linkClassName?: string;
};

/**
 * Show archive jobUrl: http(s) as a link, "not tracked" (and any non-URL) as plain text.
 */
export default function JobUrlDisplay({
  jobUrl,
  className = "",
  linkClassName = "text-orange-700 underline-offset-2 hover:underline dark:text-orange-300",
}: JobUrlDisplayProps) {
  const value = normalizeStoredJobUrl(jobUrl);

  if (!isHttpJobUrl(value)) {
    return (
      <span className={className} title={value === JOB_URL_NOT_TRACKED ? undefined : value}>
        {value}
      </span>
    );
  }

  return (
    <a
      href={value}
      target="_blank"
      rel="noopener noreferrer"
      className={`${linkClassName} ${className}`.trim()}
      title={value}
    >
      {value}
    </a>
  );
}
