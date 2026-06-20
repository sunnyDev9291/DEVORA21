"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import ResumeThinkingProgress from "@/components/ui/ResumeThinkingProgress";
import ResumeContentReview from "@/components/sections/ResumeContentReview";
import { resolveResumeWizardStep } from "@/components/sections/ResumeStepper";
import type { UserResumeTemplateAsset } from "@/lib/profile-api";
import type { ResumeGenerationPhase } from "@/lib/resume-prompt";
import { generateResume } from "@/lib/resume-generate-client";
import { archiveResume } from "@/lib/resume-archive";
import { pickBestRegenerateResult, type RegenerateEvaluation } from "@/lib/resume-ats-regenerate";
import type { GeneratedResumeContent, ResumeBuildResponse, AtsScoreResult, HumanToneScoreResult, RuleKeepScoreResult } from "@/lib/resume-types";

const PdfPreviewModal = dynamic(() => import("@/components/ui/PdfPreviewModal"), { ssr: false });
const ResumeAtsScoreModal = dynamic(() => import("@/components/ui/ResumeAtsScoreModal"));
const ResumeChatDialog = dynamic(() => import("@/components/ui/ResumeChatDialog"));

interface ResumeGeneratorProps {
  userTemplate: UserResumeTemplateAsset | null;
  userPrompt: string;
  promptFileName?: string;
  onWizardStepChange?: (step: number) => void;
}

type Step = "form" | "review" | "done";

const inputClass =
  "w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.10] hover:border-slate-300 dark:hover:border-white/[0.16] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3.5 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none transition-all";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function downloadBlob(blob: Blob, downloadName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResumeGenerator({
  userTemplate,
  userPrompt,
  promptFileName,
  onWizardStepChange,
}: ResumeGeneratorProps) {
  const [form, setForm] = useState({
    jobTitle: "",
    companyName: "",
    jobDescription: "",
    customPrompt: userPrompt,
  });
  const [step, setStep] = useState<Step>("form");
  const [content, setContent] = useState<GeneratedResumeContent | null>(null);
  const [docxBase64, setDocxBase64] = useState("");
  const [fileName, setFileName] = useState("");
  const [pdfBase64, setPdfBase64] = useState("");
  const [pdfFileName, setPdfFileName] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generationKey, setGenerationKey] = useState(0);
  const [streamPhase, setStreamPhase] = useState<ResumeGenerationPhase>("starting");
  const [atsScore, setAtsScore] = useState<AtsScoreResult | null>(null);
  const [atsLoading, setAtsLoading] = useState(false);
  const [atsError, setAtsError] = useState("");
  const [humanToneScore, setHumanToneScore] = useState<HumanToneScoreResult | null>(null);
  const [humanToneLoading, setHumanToneLoading] = useState(false);
  const [humanToneError, setHumanToneError] = useState("");
  const [ruleKeepScore, setRuleKeepScore] = useState<RuleKeepScoreResult | null>(null);
  const [ruleKeepLoading, setRuleKeepLoading] = useState(false);
  const [ruleKeepError, setRuleKeepError] = useState("");
  const [regenerateNotice, setRegenerateNotice] = useState("");
  const [atsModalOpen, setAtsModalOpen] = useState(false);
  const [resumeChatOpen, setResumeChatOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const atsAbortRef = useRef<AbortController | null>(null);
  const generationRunRef = useRef(0);
  const keywordsCacheKeyRef = useRef<string | null>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const successBannerRef = useRef<HTMLDivElement>(null);
  const promptPrefsLoadedRef = useRef(false);

  useEffect(() => {
    setForm((prev) => ({ ...prev, customPrompt: userPrompt }));
    promptPrefsLoadedRef.current = true;
  }, [userPrompt]);

  const wizardStep = resolveResumeWizardStep({
    hasTemplate: !!userTemplate,
    generating,
    hasDraft: !!content,
    isDone: step === "done",
  });

  useEffect(() => {
    onWizardStepChange?.(wizardStep);
  }, [wizardStep, onWizardStepChange]);

  useEffect(() => {
    setStep("form");
    setContent(null);
    setGenerationKey(0);
    setDocxBase64("");
    setFileName("");
    setPdfBase64("");
    setPdfFileName("");
    setArchiveError("");
    setPreviewOpen(false);
    setError("");
    setStreamPhase("starting");
    setAtsScore(null);
    setAtsError("");
    setHumanToneScore(null);
    setHumanToneError("");
    setRuleKeepScore(null);
    setRuleKeepError("");
    setAtsModalOpen(false);
    setResumeChatOpen(false);
    keywordsCacheKeyRef.current = null;
  }, [userTemplate?.fileName, userTemplate?.templateBase64]);

  useEffect(() => {
    keywordsCacheKeyRef.current = null;
    setRuleKeepScore(null);
    setRuleKeepError("");
  }, [form.jobTitle, form.companyName, form.jobDescription, form.customPrompt]);

  useEffect(() => () => {
    abortRef.current?.abort();
    atsAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (step === "review" && content) {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [step, content, generationKey]);

  useEffect(() => {
    if (step === "done" && docxBase64) {
      successBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [step, docxBase64]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleClear() {
    if (generating || applying) return;

    abortRef.current?.abort();
    atsAbortRef.current?.abort();

    setForm((prev) => ({
      ...prev,
      jobTitle: "",
      companyName: "",
      jobDescription: "",
    }));
    setStep("form");
    setContent(null);
    setGenerationKey((k) => k + 1);
    setDocxBase64("");
    setFileName("");
    setPdfBase64("");
    setPdfFileName("");
    setArchiveError("");
    setPreviewOpen(false);
    setError("");
    setStreamPhase("starting");
    setAtsScore(null);
    setAtsError("");
    setHumanToneScore(null);
    setHumanToneError("");
    setRuleKeepScore(null);
    setRuleKeepError("");
    setRegenerateNotice("");
    setAtsModalOpen(false);
    setResumeChatOpen(false);
    keywordsCacheKeyRef.current = null;
  }

  const hasClearableContent =
    !!form.jobTitle.trim() ||
    !!form.companyName.trim() ||
    !!form.jobDescription.trim() ||
    !!content ||
    step !== "form" ||
    !!docxBase64 ||
    !!pdfBase64;

  const targetJobLabel = `${form.jobTitle.trim()} at ${form.companyName.trim()}`;

  const canGenerate = !!userTemplate && !!form.jobTitle.trim() && !!form.companyName.trim();

  async function evaluateResumeScores(
    resumeContent: GeneratedResumeContent,
    options?: {
      openModal?: boolean;
      preserveScore?: boolean;
      reuseKeywords?: boolean;
    }
  ): Promise<RegenerateEvaluation | null> {
    atsAbortRef.current?.abort();
    const controller = new AbortController();
    atsAbortRef.current = controller;

    setAtsLoading(true);
    setHumanToneLoading(true);
    setRuleKeepLoading(true);
    setAtsError("");
    setHumanToneError("");
    setRuleKeepError("");
    if (!options?.preserveScore) {
      setAtsScore(null);
      setHumanToneScore(null);
      setRuleKeepScore(null);
    }
    if (options?.openModal !== false) {
      setAtsModalOpen(true);
    }

    try {
      const res = await fetch("/api/resume/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: form.jobTitle,
          companyName: form.companyName,
          jobDescription: form.jobDescription,
          content: resumeContent,
          customPrompt: form.customPrompt,
          ...(options?.reuseKeywords && keywordsCacheKeyRef.current
            ? { keywordsCacheKey: keywordsCacheKeyRef.current }
            : {}),
        }),
        signal: controller.signal,
      });

      const data = (await res.json()) as RegenerateEvaluation & {
        ruleKeep?: RuleKeepScoreResult;
        keywordsCacheKey?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data?.error || `Scoring failed (${res.status}).`);
      }

      if (data.keywordsCacheKey) {
        keywordsCacheKeyRef.current = data.keywordsCacheKey;
      }

      setAtsScore(data.ats);
      setHumanToneScore(data.humanTone);
      if (data.ruleKeep) setRuleKeepScore(data.ruleKeep);
      return { ats: data.ats, humanTone: data.humanTone };
    } catch (err) {
      if ((err as Error).name === "AbortError") return null;
      const message = (err as Error).message || "Could not evaluate resume scores.";
      setAtsError(message);
      return null;
    } finally {
      if (!controller.signal.aborted) {
        setAtsLoading(false);
        setHumanToneLoading(false);
        setRuleKeepLoading(false);
      }
    }
  }

  async function handleGenerate(
    e?: React.FormEvent,
    options?: {
      atsFeedback?: AtsScoreResult;
      humanToneFeedback?: HumanToneScoreResult;
      previousContent?: GeneratedResumeContent;
    }
  ) {
    e?.preventDefault();
    if (applying) return;
    if (!userTemplate) {
      setError("Upload a resume template on your dashboard before generating.");
      return;
    }
    if (!form.jobTitle.trim()) {
      setError("Job title is required.");
      return;
    }
    if (!form.companyName.trim()) {
      setError("Company name is required.");
      return;
    }

    abortRef.current?.abort();

    const runId = ++generationRunRef.current;
    setError("");
    setRegenerateNotice("");
    setGenerating(true);
    setStreamPhase("starting");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const data = await generateResume(
        {
          ...form,
          templateName: userTemplate.fileName,
          templateBase64: userTemplate.templateBase64,
          ...(options?.atsFeedback && { atsFeedback: options.atsFeedback }),
          ...(options?.humanToneFeedback && { humanToneFeedback: options.humanToneFeedback }),
          ...(options?.previousContent && { previousContent: options.previousContent }),
        },
        {
          onPhase: (phase) => {
            if (generationRunRef.current === runId) setStreamPhase(phase);
          },
          signal: controller.signal,
        }
      );

      if (generationRunRef.current !== runId) return;

      setDocxBase64("");
      setFileName("");
      setStep("review");

      if (options?.previousContent && options?.atsFeedback && options?.humanToneFeedback) {
        const picked = await pickBestRegenerateResult(
          options.previousContent,
          options.atsFeedback,
          options.humanToneFeedback,
          data.content,
          (candidate) =>
            evaluateResumeScores(candidate, {
              openModal: true,
              preserveScore: true,
              reuseKeywords: true,
            })
        );
        setContent(picked.content);
        setAtsScore(picked.score);
        setHumanToneScore(picked.humanToneScore);
        setRegenerateNotice(picked.notice);
        if (picked.content !== options.previousContent) {
          setGenerationKey((k) => k + 1);
        }
      } else {
        setContent(data.content);
        setGenerationKey((k) => k + 1);
        await evaluateResumeScores(data.content);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (generationRunRef.current !== runId) return;
      setError((err as Error).message || "Something went wrong.");
    } finally {
      if (generationRunRef.current === runId) {
        setGenerating(false);
        abortRef.current = null;
      }
    }
  }

  async function handleRegenerate() {
    if (applying || generating || !content) return;

    setAtsModalOpen(true);
    setAtsError("");
    setHumanToneError("");

    let scores = atsScore && humanToneScore
      ? { ats: atsScore, humanTone: humanToneScore }
      : null;

    if (!scores) {
      scores = await evaluateResumeScores(content, { openModal: true });
      if (!scores) return;
    }

    await handleGenerate(undefined, {
      atsFeedback: scores.ats,
      humanToneFeedback: scores.humanTone,
      previousContent: content,
    });
  }

  async function submitResumeArchive(docxB64: string, resumeFileName: string) {
    setArchiving(true);
    setArchiveError("");
    setPdfBase64("");
    setPdfFileName("");

    try {
      const docxBlob = base64ToBlob(docxB64, DOCX_MIME);
      const result = await archiveResume({
        jobTitle: form.jobTitle,
        companyName: form.companyName,
        jobDescription: form.jobDescription,
        docxBlob,
        fileName: resumeFileName,
      });
      setPdfBase64(result.pdfBase64);
      setPdfFileName(result.pdfFileName);
    } catch (err) {
      setArchiveError((err as Error).message || "Could not generate PDF from backend.");
    } finally {
      setArchiving(false);
    }
  }

  async function handleApply() {
    if (!content || !userTemplate || applying) return;
    setError("");
    setApplying(true);
    try {
      const res = await fetch("/api/resume/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: userTemplate.fileName,
          templateBase64: userTemplate.templateBase64,
          jobTitle: form.jobTitle,
          customPrompt: form.customPrompt,
          content,
        }),
      });
      const data = (await res.json()) as ResumeBuildResponse & { error?: string };
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
      setDocxBase64(data.docxBase64);
      setFileName(data.fileName);
      setStep("done");
      setAtsModalOpen(false);
      setArchiveError("");
      setPreviewOpen(true);
      void import("@/components/ui/PdfPreviewModal");
      void evaluateResumeScores(content, { openModal: false });
      void submitResumeArchive(data.docxBase64, data.fileName);
    } catch (err) {
      setError((err as Error).message || "Failed to update resume.");
    } finally {
      setApplying(false);
    }
  }

  function handleDownloadPdf() {
    if (!pdfBlob) return;
    downloadBlob(
      pdfBlob,
      pdfFileName || fileName.replace(/\.docx$/i, ".pdf") || "resume.pdf"
    );
  }

  function handleStartOver() {
    setStep("form");
    setContent(null);
    setDocxBase64("");
    setFileName("");
    setPdfBase64("");
    setPdfFileName("");
    setArchiveError("");
    setPreviewOpen(false);
    setError("");
    setAtsScore(null);
    setAtsError("");
    setHumanToneScore(null);
    setHumanToneError("");
    setRuleKeepScore(null);
    setRuleKeepError("");
    setRegenerateNotice("");
    setAtsModalOpen(false);
    setResumeChatOpen(false);
    keywordsCacheKeyRef.current = null;
    atsAbortRef.current?.abort();
  }

  const pdfBlob = useMemo(
    () => (pdfBase64 ? base64ToBlob(pdfBase64, PDF_MIME) : null),
    [pdfBase64]
  );

  const canPreviewPdf = !!pdfBlob && !archiving;

  const showReview = content && step !== "form";

  return (
    <>
      {/* Step 2: Job details */}
      <div className={`transition-all duration-300 ${showReview ? "mb-8" : ""}`}>
        <div className="flex items-center gap-3 mb-5">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 text-sm font-bold">2</span>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Target job details</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tell the AI what role you&apos;re applying for</p>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="jobTitle" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Job title <span className="text-red-400">*</span>
              </label>
              <input
                id="jobTitle"
                name="jobTitle"
                type="text"
                value={form.jobTitle}
                onChange={handleChange}
                placeholder="e.g. Senior Backend Engineer"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Company name <span className="text-red-400">*</span>
              </label>
              <input
                id="companyName"
                name="companyName"
                type="text"
                value={form.companyName}
                onChange={handleChange}
                placeholder="e.g. Acme Corp"
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
            <div className="flex flex-col">
              <label htmlFor="jobDescription" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Job description
              </label>
              <textarea
                id="jobDescription"
                name="jobDescription"
                value={form.jobDescription}
                onChange={handleChange}
                placeholder="Paste the full job posting for better keyword matching…"
                className={`${inputClass} h-[260px] max-h-[260px] resize-none overflow-y-auto`}
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Your profile prompt
              </label>
              {promptFileName && (
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">File: {promptFileName}</p>
              )}
              <div className={`${inputClass} h-[260px] max-h-[260px] overflow-y-auto whitespace-pre-wrap text-slate-600 dark:text-slate-300`}>
                {form.customPrompt.trim() ? (
                  form.customPrompt
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">
                    No prompt uploaded yet. Add one on your dashboard profile.
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                This prompt is loaded from your profile only. Update it on your dashboard.
              </p>
            </div>
          </div>

          {!userTemplate && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3">
              <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-amber-800 dark:text-amber-200">Upload your resume template on your dashboard before generating.</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <button
              type="submit"
              disabled={generating || applying || !canGenerate}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-500/30 hover:-translate-y-px"
            >
              {generating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating draft…
                </>
              ) : content ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate draft
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate AI draft
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={generating || applying || !hasClearableContent}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.03] hover:bg-slate-50 dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 font-semibold px-6 py-3.5 rounded-xl transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          </div>

          {generating && (
            <ResumeThinkingProgress phase={streamPhase} jobTitle={targetJobLabel} />
          )}
        </form>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3">
          <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
        </div>
      )}

      {regenerateNotice && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3">
          <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-amber-800 dark:text-amber-200">{regenerateNotice}</p>
        </div>
      )}

      {/* Step 3: Review */}
      {showReview && (
        <div ref={reviewRef} className="pt-8 border-t border-slate-200 dark:border-white/[0.06]">
          {step === "done" && docxBase64 && (
            <div
              ref={successBannerRef}
              className="mb-6 flex flex-col gap-4 rounded-2xl border border-green-500/25 bg-gradient-to-r from-green-500/[0.08] to-emerald-500/[0.05] px-5 py-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-green-800 dark:text-green-200">Resume ready</p>
                    {archiving ? (
                      <p className="text-xs text-green-700/70 dark:text-green-300/70 mt-1 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating PDF from backend…
                      </p>
                    ) : pdfFileName ? (
                      <p className="text-sm text-green-700/80 dark:text-green-300/80">{pdfFileName}</p>
                    ) : (
                      <p className="text-sm text-green-700/80 dark:text-green-300/80">{fileName}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewOpen(true);
                      void import("@/components/ui/PdfPreviewModal");
                    }}
                    disabled={!canPreviewPdf && !archiving}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-white/10 border border-green-500/20 text-green-800 dark:text-green-200 hover:bg-green-50 dark:hover:bg-white/[0.08] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {archiving ? "Generating PDF…" : "View PDF"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={!pdfBlob || archiving}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-green-600/20 transition-all"
                  >
                    Download PDF
                  </button>
                  <button type="button" onClick={handleStartOver} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all">
                    Start over
                  </button>
                </div>
              </div>
              {archiveError && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200">{archiveError}</p>
                  <button
                    type="button"
                    onClick={() => void submitResumeArchive(docxBase64, fileName)}
                    disabled={archiving}
                    className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all disabled:opacity-50"
                  >
                    Retry PDF
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400 text-sm font-bold">3</span>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Edit your draft</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Review every field, then apply to your template</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {(atsScore || humanToneScore || ruleKeepScore || atsLoading || humanToneLoading || ruleKeepLoading) && (
                <button
                  type="button"
                  onClick={() => setAtsModalOpen(true)}
                  className={`inline-flex items-center gap-2 shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                    atsScore?.passed
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15"
                      : atsScore
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15"
                        : "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  {atsLoading || humanToneLoading || ruleKeepLoading
                    ? "Scoring…"
                    : atsScore && humanToneScore
                      ? ruleKeepScore && ruleKeepScore.totalRules > 0
                        ? `ATS ${atsScore.overall} · Tone ${humanToneScore.overall} · Rules ${ruleKeepScore.overall}`
                        : `ATS ${atsScore.overall} · Tone ${humanToneScore.overall}`
                      : atsScore
                        ? `ATS ${atsScore.overall}/100`
                        : "Score report"}
                </button>
              )}
              {content && (
                <button
                  type="button"
                  onClick={() => setResumeChatOpen((open) => !open)}
                  className={`inline-flex items-center gap-2 shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                    resumeChatOpen
                      ? "border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300"
                      : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/15"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {resumeChatOpen ? "Close Q&A" : "Ask about resume"}
                </button>
              )}
            </div>
          </div>

          {atsModalOpen ? (
            <div className="rounded-2xl border border-dashed border-violet-500/25 bg-violet-500/[0.04] px-5 py-8 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                Your draft and ATS score are open in the review panel.
              </p>
              <button
                type="button"
                onClick={() => setAtsModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-all"
              >
                Open review panel
              </button>
            </div>
          ) : (
            <ResumeContentReview
              content={content}
              onChange={setContent}
              onApply={handleApply}
              onRegenerate={handleRegenerate}
              applying={applying}
              generating={generating}
              templateName={userTemplate?.fileName ?? ""}
              jobTitle={form.jobTitle}
              customPrompt={form.customPrompt}
              applyLabel={step === "done" ? "Re-apply changes" : "Apply to resume"}
              generationKey={generationKey}
            />
          )}
        </div>
      )}

      {!showReview && !generating && (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] px-6 py-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            After you generate, step 3 opens here — edit title, summary, skills, and experience before anything is written to your file.
          </p>
        </div>
      )}

      <ResumeAtsScoreModal
        open={atsModalOpen}
        onClose={() => setAtsModalOpen(false)}
        jobTitle={targetJobLabel}
        score={atsScore}
        loading={atsLoading}
        error={atsError}
        onRecheck={content ? () => evaluateResumeScores(content) : undefined}
        recheckDisabled={atsLoading || humanToneLoading || ruleKeepLoading || generating || applying || !content}
        humanToneScore={humanToneScore}
        humanToneLoading={humanToneLoading}
        humanToneError={humanToneError}
        ruleKeepScore={ruleKeepScore}
        ruleKeepLoading={ruleKeepLoading}
        ruleKeepError={ruleKeepError}
        content={content}
        onContentChange={setContent}
        onApply={handleApply}
        onRegenerate={handleRegenerate}
        applying={applying}
        generating={generating}
        streamPhase={streamPhase}
        generateError={error}
        regenerateNotice={regenerateNotice}
        templateName={userTemplate?.fileName ?? ""}
        fileNameJobTitle={form.jobTitle}
        customPrompt={form.customPrompt}
        applyLabel={step === "done" ? "Re-apply changes" : "Apply to resume"}
        generationKey={generationKey}
        onOpenResumeChat={() => setResumeChatOpen(true)}
      />

      <PdfPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={pdfFileName || fileName.replace(/\.docx$/i, ".pdf") || "Resume PDF"}
        subtitle="Tailored resume PDF · ready to download"
        blob={pdfBlob}
        fileName={pdfFileName || fileName.replace(/\.docx$/i, ".pdf") || "resume.pdf"}
        waitingForPdf={archiving}
        error={archiveError}
        onDownload={handleDownloadPdf}
      />

      {content && showReview && (
        <>
          <button
            type="button"
            onClick={() => setResumeChatOpen((open) => !open)}
            aria-label={resumeChatOpen ? "Close resume Q&A" : "Open resume Q&A"}
            aria-expanded={resumeChatOpen}
            className={`fixed bottom-6 left-6 z-[101] flex items-center gap-2 text-white text-sm font-semibold pl-3.5 pr-4 h-11 rounded-full shadow-xl transition-all duration-200 hover:-translate-y-1 hover:scale-105 ${
              resumeChatOpen
                ? "bg-slate-700 hover:bg-slate-600 shadow-slate-700/30"
                : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/30 hover:shadow-blue-500/40"
            }`}
          >
            {resumeChatOpen ? (
              <>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close Q&A
              </>
            ) : (
              <>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Resume Q&A
              </>
            )}
          </button>

          <ResumeChatDialog
            open={resumeChatOpen}
            onClose={() => setResumeChatOpen(false)}
            content={content}
            jobTitle={form.jobTitle}
            companyName={form.companyName}
            jobDescription={form.jobDescription}
            generationKey={generationKey}
          />
        </>
      )}
    </>
  );
}
