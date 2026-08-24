"use client";

import type { ReactNode } from "react";
import Modal from "@/components/ui/Modal";
import JobCheckFieldRow, {
  formatWorkArrangement,
  JobCheckSourceBadge,
} from "@/components/ui/JobCheckFieldRow";
import { EvaluationHeroLoader } from "@/components/ui/ResumeStepLoader";
import type { JobCheckResult } from "@/lib/job-check-types";

type JobCheckModalProps = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string;
  result: JobCheckResult | null;
  jobTitle: string;
  companyName: string;
  onRetry?: () => void;
};

function HeroPill({
  icon,
  label,
  value,
  source,
  evidence,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  source: JobCheckResult["position"]["workArrangement"]["source"];
  evidence?: string | null;
}) {
  return (
    <div className="flex-1 min-w-[140px] rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <JobCheckSourceBadge source={source} />
      </div>
      {evidence && source === "inferred" ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-snug">{evidence}</p>
      ) : null}
    </div>
  );
}

function CompanyCard({
  title,
  subtitle,
  accentClass,
  company,
}: {
  title: string;
  subtitle?: string;
  accentClass: string;
  company: JobCheckResult["employer"];
}) {
  return (
    <section className={`rounded-2xl border ${accentClass} bg-white dark:bg-white/[0.02] overflow-hidden`}>
      <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06]">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </p>
        <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{company.name}</h3>
        {subtitle ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      <div className="px-4 py-1">
        <JobCheckFieldRow
          label="Location"
          value={company.location.value}
          source={company.location.source}
          evidence={company.location.evidence}
        />
        <JobCheckFieldRow
          label="Industry"
          value={company.industry.value}
          source={company.industry.source}
          evidence={company.industry.evidence}
        />
        <JobCheckFieldRow
          label="Main working language"
          value={company.mainWorkingLanguage.value}
          source={company.mainWorkingLanguage.source}
          evidence={company.mainWorkingLanguage.evidence}
        />
      </div>
    </section>
  );
}

export default function JobCheckModal({
  open,
  onClose,
  loading,
  error,
  result,
  jobTitle,
  companyName,
  onRetry,
}: JobCheckModalProps) {
  const subtitle = [jobTitle.trim(), companyName.trim()].filter(Boolean).join(" · ");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Job Check"
      ariaLabel="Job Check results"
      className="max-w-2xl"
    >
      <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
        {subtitle ? (
          <p className="px-6 pt-1 pb-3 text-sm text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-white/[0.06] shrink-0">
            {subtitle}
          </p>
        ) : null}

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading ? (
            <EvaluationHeroLoader
              title="Analyzing job posting"
              description="Checking company, client, work mode, language, and compensation…"
              accent="sky"
            />
          ) : error ? (
            <div className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3">
              <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 inline-flex items-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                >
                  Try again
                </button>
              ) : null}
            </div>
          ) : result ? (
            <>
              <div className="flex flex-col sm:flex-row gap-3">
                <HeroPill
                  icon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  }
                  label="Work arrangement"
                  value={formatWorkArrangement(result.position.workArrangement.value)}
                  source={result.position.workArrangement.source}
                  evidence={result.position.workArrangement.evidence}
                />
                <HeroPill
                  icon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                  }
                  label="Working language"
                  value={result.position.mainWorkingLanguage.value ?? "Unknown"}
                  source={result.position.mainWorkingLanguage.source}
                  evidence={result.position.mainWorkingLanguage.evidence}
                />
              </div>

              {result.warnings.length > 0 ? (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 space-y-1">
                  {result.warnings.map((warning) => (
                    <p key={warning} className="text-xs text-amber-800 dark:text-amber-200">
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}

              <CompanyCard
                title="Employer company"
                company={result.employer}
                accentClass="border-blue-500/20"
              />

              {result.client.mentioned && result.client.company ? (
                <CompanyCard
                  title="End client"
                  subtitle="Mentioned in the job description"
                  company={result.client.company}
                  accentClass="border-violet-500/25"
                />
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 px-1">
                  No end client mentioned in the job description.
                </p>
              )}

              <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] overflow-hidden">
                <div className="px-4 py-3 border-b border-emerald-500/15">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Compensation
                  </p>
                </div>
                <div className="px-4 py-3">
                  {result.compensation.mentioned ? (
                    <div className="space-y-2">
                      {result.compensation.summary ? (
                        <p className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
                          {result.compensation.summary}
                        </p>
                      ) : null}
                      {result.compensation.benefits.length > 0 ? (
                        <ul className="text-sm text-slate-600 dark:text-slate-300 list-disc pl-5 space-y-0.5">
                          {result.compensation.benefits.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                      {result.compensation.rawQuote ? (
                        <p className="text-xs italic text-slate-500 dark:text-slate-400 border-l-2 border-emerald-500/30 pl-3">
                          &ldquo;{result.compensation.rawQuote}&rdquo;
                        </p>
                      ) : null}
                      <JobCheckSourceBadge source={result.compensation.source} />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No salary or compensation details found.
                    </p>
                  )}
                </div>
              </section>

              {result.position.secondaryLanguages.length > 0 ? (
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-white">Other languages: </span>
                  {result.position.secondaryLanguages.join(", ")}
                </div>
              ) : null}

              {result.notes.length > 0 ? (
                <section className="rounded-xl border border-slate-200 dark:border-white/[0.08] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                    Analysis notes
                  </p>
                  <ul className="space-y-1.5">
                    {result.notes.map((note) => (
                      <li key={note} className="text-sm text-slate-600 dark:text-slate-300 flex gap-2">
                        <span className="text-slate-400 shrink-0">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}
        </div>

        {!loading ? (
          <div className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-white/[0.08] flex justify-end gap-2">
            {result && onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center rounded-xl border border-slate-200 dark:border-white/[0.12] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              >
                Re-run check
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-xl bg-slate-900 dark:bg-white px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 hover:opacity-90"
            >
              Close
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
