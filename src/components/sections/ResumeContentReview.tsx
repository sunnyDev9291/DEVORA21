"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GeneratedResumeContent, ResumeExperience } from "@/lib/resume-types";
import { buildExpectedResumeBaseName } from "@/lib/resume-filename";

interface ResumeContentReviewProps {
  content: GeneratedResumeContent;
  onChange: (content: GeneratedResumeContent) => void;
  onApply: () => void;
  onRegenerate: () => void;
  applying: boolean;
  generating?: boolean;
  templateName: string;
  jobTitle?: string;
  applyLabel?: string;
  generationKey: number;
  /** Compact layout for side-by-side use inside the ATS modal */
  embedded?: boolean;
}

const fieldClass =
  "w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.10] hover:border-slate-300 dark:hover:border-white/[0.16] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm outline-none transition-all";

export default function ResumeContentReview({
  content,
  onChange,
  onApply,
  onRegenerate,
  applying,
  generating = false,
  templateName,
  jobTitle = "",
  applyLabel = "Apply to Resume",
  generationKey,
  embedded = false,
}: ResumeContentReviewProps) {
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [expandedExp, setExpandedExp] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyBullet = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1800);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setReviewConfirmed(false);
    setExpandedExp(null);
  }, [generationKey, templateName]);

  function updateExperience(index: number, patch: Partial<ResumeExperience>) {
    onChange({
      ...content,
      experiences: content.experiences.map((exp, i) => (i === index ? { ...exp, ...patch } : exp)),
    });
  }

  function updateBullet(expIndex: number, bulletIndex: number, value: string) {
    const bullets = content.experiences[expIndex].bullets.map((b, i) =>
      i === bulletIndex ? value : b
    );
    updateExperience(expIndex, { bullets });
  }

  const bulletFieldClass = `${fieldClass} flex-1 min-h-[72px] resize-y leading-relaxed`;

  const canApply =
    reviewConfirmed &&
    content.title.trim() &&
    content.summary.trim() &&
    content.skills.trim() &&
    content.experiences.every((exp) => exp.company.trim() && exp.role.trim() && exp.bullets.some((b) => b.trim()));

  const expectedResumeName = useMemo(
    () => buildExpectedResumeBaseName(templateName, jobTitle, content),
    [templateName, jobTitle, content]
  );

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      <div className={`grid grid-cols-1 ${embedded ? "" : "lg:grid-cols-2"} gap-4`}>
        <div className={`${embedded ? "" : "lg:col-span-2"} rounded-2xl border border-blue-500/20 bg-blue-500/[0.05] px-5 py-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">AI draft — edit before applying</p>
              <p className="text-xs text-blue-700/70 dark:text-blue-300/70 mt-0.5">
                Template: <span className="font-medium">{templateName}</span> · Nothing saves until you confirm below
              </p>
            </div>
            <button
              type="button"
              onClick={onRegenerate}
              disabled={applying || generating}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/[0.05] transition-all disabled:opacity-50"
            >
              {generating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Regenerating…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate
                </>
              )}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-5">
          <label htmlFor="resume-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-2">
            <span className="w-6 h-6 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">T</span>
            Resume title
          </label>
          <input id="resume-title" type="text" value={content.title} onChange={(e) => onChange({ ...content, title: e.target.value })} className={fieldClass} placeholder="Senior Engineer | React | AWS" />
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-5">
          <label htmlFor="resume-skills" className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-2">
            <span className="w-6 h-6 rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs">S</span>
            Skillsets
          </label>
          <textarea id="resume-skills" rows={3} value={content.skills} onChange={(e) => onChange({ ...content, skills: e.target.value })} className={`${fieldClass} resize-y min-h-[88px]`} placeholder="Comma-separated skills" />
        </div>

        <div className={`${embedded ? "" : "lg:col-span-2"} rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-5`}>
          <label htmlFor="resume-summary" className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-2">
            <span className="w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs">∑</span>
            Summary
          </label>
          <textarea id="resume-summary" rows={4} value={content.summary} onChange={(e) => onChange({ ...content, summary: e.target.value })} className={`${fieldClass} resize-y min-h-[120px] leading-relaxed`} />
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs">E</span>
          Experience ({content.experiences.length})
        </h4>
        <div className="space-y-2">
          {content.experiences.map((exp, index) => {
            const open = expandedExp === index;
            return (
              <div key={`exp-${index}`} className="rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden bg-white dark:bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => setExpandedExp(open ? null : index)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                  aria-expanded={open}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {exp.role && exp.company
                        ? exp.dates
                          ? `${exp.role}, ${exp.company}, ${exp.dates}`
                          : `${exp.role}, ${exp.company}`
                        : exp.company || "Company"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {exp.bullets.length} bullet{exp.bullets.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <svg className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {open && (
                  <div className="px-5 pb-5 pt-0 space-y-3 border-t border-slate-100 dark:border-white/[0.06]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                      <div className="sm:col-span-2">
                        <p className="text-xs font-medium text-slate-500 mb-1">Company <span className="font-normal text-slate-400">(from template)</span></p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white px-1">{exp.company}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Role <span className="font-normal text-slate-400">(from template)</span></p>
                        <p className="text-sm text-slate-800 dark:text-slate-200 px-1">{exp.role}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Dates <span className="font-normal text-slate-400">(from template)</span></p>
                        <p className="text-sm text-slate-800 dark:text-slate-200 px-1">{exp.dates}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-2">
                        Achievement bullets <span className="font-normal text-slate-400">({exp.bullets.length})</span>
                      </p>
                      <div className="space-y-3">
                        {exp.bullets.map((bullet, bulletIndex) => (
                          <div
                            key={`exp-${index}-bullet-${bulletIndex}`}
                            className="flex gap-3 items-start rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.02] p-3"
                          >
                            <span
                              className="shrink-0 w-7 h-7 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs font-bold mt-1.5"
                              aria-hidden="true"
                            >
                              {bulletIndex + 1}
                            </span>
                            <label htmlFor={`exp-${index}-bullet-${bulletIndex}`} className="sr-only">
                              Bullet {bulletIndex + 1} for {exp.company}
                            </label>
                            <textarea
                              id={`exp-${index}-bullet-${bulletIndex}`}
                              rows={2}
                              value={bullet}
                              onChange={(e) => updateBullet(index, bulletIndex, e.target.value)}
                              className={bulletFieldClass}
                              placeholder={`Achievement ${bulletIndex + 1}`}
                            />
                            <button
                              type="button"
                              onClick={() => copyBullet(`${index}-${bulletIndex}`, bullet)}
                              title="Copy bullet"
                              className="shrink-0 mt-1.5 w-7 h-7 rounded-lg flex items-center justify-center border transition-all
                                border-slate-200 dark:border-white/[0.10]
                                bg-white dark:bg-white/[0.04]
                                text-slate-400 hover:text-blue-600 dark:hover:text-blue-400
                                hover:border-blue-400 dark:hover:border-blue-500
                                hover:bg-blue-50 dark:hover:bg-blue-500/10"
                            >
                              {copiedKey === `${index}-${bulletIndex}` ? (
                                <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {expectedResumeName && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] px-5 py-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Expected resume name</p>
          <p className="text-sm font-mono font-semibold text-slate-900 dark:text-white break-all">
            {expectedResumeName}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Updates as you edit title and skills · saved as <span className="font-mono">{expectedResumeName}.docx</span>
          </p>
        </div>
      )}

      <div className={`${embedded ? "rounded-2xl border border-slate-200 dark:border-white/[0.10] bg-slate-50/80 dark:bg-white/[0.02] p-4" : "sticky bottom-4 z-10 rounded-2xl border border-slate-200 dark:border-white/[0.10] bg-white/95 dark:bg-navy-900/95 backdrop-blur-md shadow-xl shadow-slate-200/50 dark:shadow-black/40 p-5"}`}>
        <label className="flex items-start gap-3 cursor-pointer mb-4">
          <input type="checkbox" checked={reviewConfirmed} onChange={(e) => setReviewConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
          <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            I&apos;ve reviewed and edited this content. Apply it to my resume file.
          </span>
        </label>
        <button
          type="button"
          onClick={onApply}
          disabled={applying || generating || !canApply}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-blue-600/25 transition-all"
        >
          {applying ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Building your .docx…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {applyLabel}
            </>
          )}
        </button>
        {!reviewConfirmed && <p className="text-xs text-slate-400 text-center mt-2">Check the box above to enable apply</p>}
      </div>
    </div>
  );
}
