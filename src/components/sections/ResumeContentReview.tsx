"use client";

import { useCallback, useEffect, useState } from "react";
import type { GeneratedResumeContent, ResumeExperience, ResumeProject } from "@/lib/resume-types";
import { isProjectLayout } from "@/lib/resume-experience-utils";
import { sanitizeResumeFileBaseName } from "@/lib/resume-filename";
import MarkdownBoldTextarea from "@/components/ui/MarkdownBoldTextarea";
import ResumeRegenerateDiffPanel from "@/components/ui/ResumeRegenerateDiffPanel";
import type { FeedbackResolution, ResumeFieldChange } from "@/lib/resume-content-diff";

interface ResumeContentReviewProps {
  content: GeneratedResumeContent;
  onChange: (content: GeneratedResumeContent) => void;
  onApply: () => void;
  onRegenerate: () => void;
  applying: boolean;
  generating?: boolean;
  templateName: string;
  resumeFileBaseName: string;
  suggestedResumeBaseName: string;
  onResumeFileBaseNameChange: (value: string) => void;
  onResumeFileBaseNameReset?: () => void;
  applyLabel?: string;
  generationKey: number;
  /** Compact layout for side-by-side use inside the ATS modal */
  embedded?: boolean;
  regenerateChanges?: ResumeFieldChange[];
  regenerateFeedback?: FeedbackResolution | null;
  changedFieldIds?: Set<string>;
  onDismissRegenerateDiff?: () => void;
}

const PROJECT_FIELDS: Array<{ key: keyof ResumeProject; label: string }> = [
  { key: "businessChallenge", label: "Business Challenge" },
  { key: "assignedResponsibility", label: "Assigned Responsibility" },
  { key: "action", label: "Action" },
  { key: "result", label: "Result" },
];

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
  resumeFileBaseName,
  suggestedResumeBaseName,
  onResumeFileBaseNameChange,
  onResumeFileBaseNameReset,
  applyLabel = "Apply to Resume",
  generationKey,
  embedded = false,
  regenerateChanges = [],
  regenerateFeedback = null,
  changedFieldIds,
  onDismissRegenerateDiff,
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

  function updateProject(expIndex: number, projectIndex: number, patch: Partial<ResumeProject>) {
    const projects = (content.experiences[expIndex].projects ?? []).map((project, i) =>
      i === projectIndex ? { ...project, ...patch } : project
    );
    updateExperience(expIndex, { projects });
  }

  const projectMode = isProjectLayout(content.layout);

  const experienceValid = (exp: ResumeExperience) => {
    if (!exp.company.trim() || !exp.role.trim()) return false;
    if (projectMode || exp.projects?.length) {
      return (exp.projects ?? []).some(
        (p) =>
          p.name.trim() &&
          (p.businessChallenge.trim() || p.action.trim()) &&
          p.assignedResponsibility.trim() &&
          p.result.trim()
      );
    }
    return exp.bullets.some((b) => b.trim());
  };

  const canApply =
    reviewConfirmed &&
    resumeFileBaseName.trim() &&
    content.title.trim() &&
    content.summary.trim() &&
    content.skills.trim() &&
    content.experiences.every(experienceValid);

  const showNameReset =
    Boolean(onResumeFileBaseNameReset) &&
    suggestedResumeBaseName &&
    resumeFileBaseName.trim() !== suggestedResumeBaseName.trim();

  const changedRing = (fieldId: string) =>
    changedFieldIds?.has(fieldId)
      ? "ring-2 ring-amber-400/50 border-amber-400/40"
      : "";
  const skillLineCount = content.skills.split(/\n+/).filter((line) => line.trim()).length;
  const summaryWordCount = content.summary.split(/\s+/).filter(Boolean).length;

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      {(regenerateChanges.length > 0 || regenerateFeedback) && (
        <ResumeRegenerateDiffPanel
          changes={regenerateChanges}
          feedback={regenerateFeedback}
          onDismiss={onDismissRegenerateDiff}
        />
      )}

      <div className={`grid grid-cols-1 ${embedded ? "" : "lg:grid-cols-2"} gap-4`}>
        <div className={`${embedded ? "" : "lg:col-span-2"} rounded-2xl border border-blue-500/20 bg-blue-500/[0.05] px-5 py-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">AI draft — edit before applying</p>
              <p className="text-xs text-blue-700/70 dark:text-blue-300/70 mt-0.5">
                Template: <span className="font-medium">{templateName}</span>
                {regenerateChanges.length > 0 ? (
                  <span> · {regenerateChanges.length} change{regenerateChanges.length === 1 ? "" : "s"} from last draft</span>
                ) : (
                  <span> · Nothing saves until you confirm below</span>
                )}
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
          <MarkdownBoldTextarea
            id="resume-title"
            value={content.title}
            onChange={(title) => onChange({ ...content, title })}
            className={`${fieldClass} ${changedRing("title")}`}
            rows={1}
            placeholder="Senior Engineer | React | AWS"
          />
        </div>

        <div className={`${embedded ? "" : "lg:col-span-2"} rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-5`}>
          <label htmlFor="resume-skills" className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-2">
            <span className="w-6 h-6 rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs">S</span>
            Skillsets
          </label>
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>{skillLineCount} categor{skillLineCount === 1 ? "y" : "ies"}</span>
            <span>One category per line works best</span>
            <span>Use Ctrl/Cmd+B for bold</span>
          </div>
          <MarkdownBoldTextarea
            id="resume-skills"
            value={content.skills}
            onChange={(skills) => onChange({ ...content, skills })}
            className={`${fieldClass} min-h-[180px] resize-y leading-relaxed ${changedRing("skills")}`}
            rows={6}
            minHeight={180}
            maxHeight={420}
            placeholder={"Languages: C#, TypeScript\nBackend: .NET, ASP.NET Core, Web APIs\nFrontend: React"}
          />
          <p className="mt-2 text-xs text-slate-400">
            Keep categories JD-specific. Template styling is applied later.
          </p>
        </div>

        <div className={`${embedded ? "" : "lg:col-span-2"} rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-5`}>
          <label htmlFor="resume-summary" className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-2">
            <span className="w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs">∑</span>
            Summary
          </label>
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>{summaryWordCount} words</span>
            <span>2-4 focused sentences is easiest to review</span>
            <span>Use Ctrl/Cmd+B for key terms</span>
          </div>
          <MarkdownBoldTextarea
            id="resume-summary"
            value={content.summary}
            onChange={(summary) => onChange({ ...content, summary })}
            className={`${fieldClass} min-h-[220px] resize-y text-[15px] leading-7 ${changedRing("summary")}`}
            rows={8}
            minHeight={220}
            maxHeight={520}
            placeholder="Write a concise, JD-targeted professional summary..."
          />
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
                      {projectMode || exp.projects?.length
                        ? `${exp.projects?.length ?? 0} project${(exp.projects?.length ?? 0) === 1 ? "" : "s"}`
                        : `${exp.bullets.length} bullet${exp.bullets.length === 1 ? "" : "s"}`}
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
                        <p className="text-xs font-medium text-slate-500 mb-1">
                          Role / title <span className="font-normal text-slate-400">(tailored to JD)</span>
                        </p>
                        <MarkdownBoldTextarea
                          id={`exp-${index}-role`}
                          value={exp.role}
                          onChange={(role) => updateExperience(index, { role })}
                          className={`${fieldClass} ${changedRing(`exp-${index}-role`)}`}
                          rows={1}
                          placeholder="Senior Java Engineer | Spring Boot"
                          aria-label={`Role for ${exp.company}`}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Dates <span className="font-normal text-slate-400">(from template)</span></p>
                        <p className="text-sm text-slate-800 dark:text-slate-200 px-1">{exp.dates}</p>
                      </div>
                    </div>
                    {projectMode || exp.projects?.length ? (
                      <div className="space-y-4">
                        {(exp.projects ?? []).map((project, projectIndex) => (
                          <div
                            key={`exp-${index}-project-${projectIndex}`}
                            className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.02] p-4 space-y-3"
                          >
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                              Project {projectIndex + 1}
                            </p>
                            <div>
                              <p className="text-xs font-medium text-slate-500 mb-1">
                                Project name <span className="font-normal text-slate-400">(from template)</span>
                              </p>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white px-1">{project.name}</p>
                            </div>
                            {PROJECT_FIELDS.map(({ key, label }) => (
                              <div key={`${index}-${projectIndex}-${key}`}>
                                <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
                                <MarkdownBoldTextarea
                                  id={`exp-${index}-project-${projectIndex}-${key}`}
                                  value={project[key]}
                                  onChange={(value) => updateProject(index, projectIndex, { [key]: value })}
                                  className={`${fieldClass} min-h-[72px] resize-y leading-relaxed ${changedRing(`exp-${index}-proj-${projectIndex}-${key}`)}`}
                                  rows={2}
                                  placeholder={label}
                                  aria-label={`${label} for project ${projectIndex + 1} at ${exp.company}`}
                                />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
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
                              <MarkdownBoldTextarea
                                id={`exp-${index}-bullet-${bulletIndex}`}
                                value={bullet}
                                onChange={(value) => updateBullet(index, bulletIndex, value)}
                                className={`${fieldClass} flex-1 min-h-[72px] resize-y leading-relaxed ${changedRing(`exp-${index}-bullet-${bulletIndex}`)}`}
                                rows={2}
                                placeholder={`Achievement ${bulletIndex + 1}`}
                                aria-label={`Bullet ${bulletIndex + 1} for ${exp.company}`}
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
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] px-5 py-4">
        <label htmlFor="resume-file-name" className="text-xs font-medium text-slate-500 mb-2 block">
          Expected resume name
          {content.fileName?.trim() ? (
            <span className="font-normal text-slate-400"> · from AI</span>
          ) : content.title.trim() ? (
            <span className="font-normal text-slate-400"> · from resume title</span>
          ) : null}
        </label>
        <input
          id="resume-file-name"
          type="text"
          value={resumeFileBaseName}
          onChange={(e) => onResumeFileBaseNameChange(sanitizeResumeFileBaseName(e.target.value))}
          className={`${fieldClass} font-mono`}
          placeholder="Franco_Torrez_Senior_Software_Engineer_React,AWS"
          spellCheck={false}
          autoComplete="off"
        />
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <span>
            Saved as <span className="font-mono text-slate-500 dark:text-slate-300">{resumeFileBaseName.trim() || "resume"}.docx</span>
          </span>
          {showNameReset && (
            <button
              type="button"
              onClick={onResumeFileBaseNameReset}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Reset to suggested
            </button>
          )}
        </div>
      </div>

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
