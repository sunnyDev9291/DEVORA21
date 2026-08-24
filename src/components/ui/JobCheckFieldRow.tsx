import type { FieldSource } from "@/lib/job-check-types";

const SOURCE_LABEL: Record<FieldSource, string> = {
  stated: "Stated",
  inferred: "Inferred",
  unknown: "Unknown",
};

const SOURCE_CLASS: Record<FieldSource, string> = {
  stated: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  inferred: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  unknown: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

type JobCheckFieldRowProps = {
  label: string;
  value: string | null;
  source?: FieldSource;
  evidence?: string | null;
};

export default function JobCheckFieldRow({
  label,
  value,
  source = "unknown",
  evidence,
}: JobCheckFieldRowProps) {
  const display = value?.trim() || "—";

  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 dark:border-white/[0.06] last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">{display}</p>
        {evidence && source === "inferred" ? (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{evidence}</p>
        ) : null}
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SOURCE_CLASS[source]}`}
      >
        {SOURCE_LABEL[source]}
      </span>
    </div>
  );
}

export function JobCheckSourceBadge({ source }: { source: FieldSource }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SOURCE_CLASS[source]}`}
    >
      {SOURCE_LABEL[source]}
    </span>
  );
}

export function formatWorkArrangement(value: string | null): string {
  switch (value) {
    case "remote":
      return "Remote";
    case "hybrid":
      return "Hybrid";
    case "onsite":
      return "On-site";
    default:
      return "Unknown";
  }
}
