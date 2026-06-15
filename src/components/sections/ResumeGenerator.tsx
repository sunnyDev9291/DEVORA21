"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import DocxPreviewModal from "@/components/ui/DocxPreviewModal";
import SavedPromptPicker from "@/components/ui/SavedPromptPicker";
import ResumeThinkingProgress from "@/components/ui/ResumeThinkingProgress";
import ResumeAtsScoreModal from "@/components/ui/ResumeAtsScoreModal";
import ResumeContentReview from "@/components/sections/ResumeContentReview";
import { resolveResumeWizardStep } from "@/components/sections/ResumeStepper";
import type { ResumeTemplate } from "@/lib/resume-template";
import type { ResumePromptOption } from "@/lib/resume-prompt-option";
import type { ResumeGenerationPhase } from "@/lib/resume-prompt";
import { consumeResumeStream } from "@/lib/resume-stream-client";
import type { GeneratedResumeContent, ResumeBuildResponse, AtsScoreResult } from "@/lib/resume-types";

interface ResumeGeneratorProps {
  selectedTemplate: ResumeTemplate | null;
  onWizardStepChange?: (step: number) => void;
}

type Step = "form" | "review" | "done";

const inputClass =
  "w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.10] hover:border-slate-300 dark:hover:border-white/[0.16] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3.5 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none transition-all";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export default function ResumeGenerator({
  selectedTemplate,
  onWizardStepChange,
}: ResumeGeneratorProps) {
  const [form, setForm] = useState({ jobTitle: "", jobDescription: "", customPrompt: "" });
  const [prompts, setPrompts] = useState<ResumePromptOption[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [promptListError, setPromptListError] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [content, setContent] = useState<GeneratedResumeContent | null>(null);
  const [docxBase64, setDocxBase64] = useState("");
  const [fileName, setFileName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generationKey, setGenerationKey] = useState(0);
  const [streamPhase, setStreamPhase] = useState<ResumeGenerationPhase>("starting");
  const [atsScore, setAtsScore] = useState<AtsScoreResult | null>(null);
  const [atsLoading, setAtsLoading] = useState(false);
  const [atsError, setAtsError] = useState("");
  const [atsModalOpen, setAtsModalOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const atsAbortRef = useRef<AbortController | null>(null);
  const generationRunRef = useRef(0);
  const reviewRef = useRef<HTMLDivElement>(null);

  const wizardStep = resolveResumeWizardStep({
    hasTemplate: !!selectedTemplate,
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
    setPreviewOpen(false);
    setError("");
    setStreamPhase("starting");
    setAtsScore(null);
    setAtsError("");
    setAtsModalOpen(false);
  }, [selectedTemplate?.id]);

  useEffect(() => () => {
    abortRef.current?.abort();
    atsAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPromptListError("");
      try {
        const res = await fetch("/api/prompts", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Failed to load prompts (${res.status}).`);
        if (!cancelled) setPrompts(data.prompts ?? []);
      } catch (err) {
        if (!cancelled) {
          setPrompts([]);
          setPromptListError((err as Error).message || "Could not load saved prompts.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (step === "review" && content) {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [step, content, generationKey]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.target.name === "customPrompt") setSelectedPromptId("");
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handlePromptSelect(promptId: string) {
    setSelectedPromptId(promptId);
    setError("");

    if (!promptId) {
      setForm((prev) => ({ ...prev, customPrompt: "" }));
      return;
    }

    const prompt = prompts.find((p) => p.id === promptId);
    if (!prompt) return;

    setLoadingPrompt(true);
    try {
      const res = await fetch(prompt.file, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed to load prompt (${res.status}).`);
      setForm((prev) => ({ ...prev, customPrompt: data.content ?? "" }));
    } catch (err) {
      setSelectedPromptId("");
      setError((err as Error).message || "Could not load the selected prompt.");
    } finally {
      setLoadingPrompt(false);
    }
  }

  function handleClear() {
    if (generating || applying) return;
    setForm({ jobTitle: "", jobDescription: "", customPrompt: "" });
    setSelectedPromptId("");
    setError("");
  }

  const formHasContent = form.jobTitle.trim() || form.jobDescription.trim() || form.customPrompt.trim();

  async function evaluateAts(resumeContent: GeneratedResumeContent, options?: { openModal?: boolean }) {
    atsAbortRef.current?.abort();
    const controller = new AbortController();
    atsAbortRef.current = controller;

    setAtsLoading(true);
    setAtsError("");
    setAtsScore(null);
    if (options?.openModal !== false) {
      setAtsModalOpen(true);
    }

    try {
      const res = await fetch("/api/resume/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: form.jobTitle,
          jobDescription: form.jobDescription,
          content: resumeContent,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `ATS evaluation failed (${res.status}).`);
      setAtsScore(data as AtsScoreResult);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setAtsError((err as Error).message || "Could not evaluate ATS score.");
    } finally {
      if (!controller.signal.aborted) setAtsLoading(false);
    }
  }

  async function handleGenerate(e?: React.FormEvent) {
    e?.preventDefault();
    if (applying) return;
    if (!selectedTemplate) {
      setError("Choose a resume template above before generating.");
      return;
    }

    abortRef.current?.abort();

    const runId = ++generationRunRef.current;
    setError("");
    setGenerating(true);
    setStreamPhase("starting");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/resume/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, templateName: selectedTemplate.name }),
        signal: controller.signal,
      });

      const data = await consumeResumeStream(res, {
        onPhase: (phase) => {
          if (generationRunRef.current === runId) setStreamPhase(phase);
        },
      });

      if (generationRunRef.current !== runId) return;

      setContent(data.content);
      setDocxBase64("");
      setFileName("");
      setGenerationKey((k) => k + 1);
      setStep("review");
      void evaluateAts(data.content);
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

  function handleRegenerate() {
    if (applying) return;

    atsAbortRef.current?.abort();
    setAtsScore(null);
    setAtsError("");
    setAtsLoading(true);
    setAtsModalOpen(true);

    void handleGenerate();
  }

  async function handleApply() {
    if (!content || !selectedTemplate || applying) return;
    setError("");
    setApplying(true);
    try {
      const res = await fetch("/api/resume/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateName: selectedTemplate.name, content }),
      });
      const data = (await res.json()) as ResumeBuildResponse & { error?: string };
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
      setDocxBase64(data.docxBase64);
      setFileName(data.fileName);
      setStep("done");
      setAtsModalOpen(false);
      setPreviewOpen(true);
      void evaluateAts(content, { openModal: false });
    } catch (err) {
      setError((err as Error).message || "Failed to update resume.");
    } finally {
      setApplying(false);
    }
  }

  function handleDownload() {
    if (!docxBlob) return;
    const url = URL.createObjectURL(docxBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "resume.docx";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleStartOver() {
    setStep("form");
    setContent(null);
    setDocxBase64("");
    setFileName("");
    setPreviewOpen(false);
    setError("");
    setAtsScore(null);
    setAtsError("");
    setAtsModalOpen(false);
    atsAbortRef.current?.abort();
  }

  const docxBlob = useMemo(
    () => (docxBase64 ? base64ToBlob(docxBase64, DOCX_MIME) : null),
    [docxBase64]
  );

  const [previewSourceUrl, setPreviewSourceUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!docxBlob) {
      setPreviewSourceUrl(null);
      return;
    }

    const url = URL.createObjectURL(docxBlob);
    setPreviewSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [docxBlob]);

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
          <div>
            <label htmlFor="jobTitle" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Job title <span className="text-red-400">*</span>
            </label>
            <input id="jobTitle" name="jobTitle" type="text" value={form.jobTitle} onChange={handleChange} placeholder="e.g. Senior Backend Engineer" className={inputClass} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
            <div className="flex flex-col min-h-[220px] lg:min-h-[280px]">
              <label htmlFor="jobDescription" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Job description
              </label>
              <textarea
                id="jobDescription"
                name="jobDescription"
                value={form.jobDescription}
                onChange={handleChange}
                placeholder="Paste the full job posting for better keyword matching…"
                className={`${inputClass} flex-1 min-h-[200px] lg:min-h-[260px] resize-y`}
              />
            </div>
            <div className="flex flex-col min-h-[220px] lg:min-h-[280px]">
              <label htmlFor="customPrompt" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Extra instructions <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              {prompts.length > 0 && (
                <SavedPromptPicker
                  prompts={prompts}
                  selectedId={selectedPromptId}
                  loading={loadingPrompt}
                  disabled={generating || applying}
                  onSelect={handlePromptSelect}
                />
              )}
              {promptListError && prompts.length === 0 && (
                <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">{promptListError}</p>
              )}
              <textarea
                id="customPrompt"
                name="customPrompt"
                value={form.customPrompt}
                onChange={handleChange}
                placeholder="Years of experience, tech stack, tone, achievements to highlight…"
                className={`${inputClass} flex-1 min-h-[200px] lg:min-h-[260px] resize-y`}
              />
            </div>
          </div>

          {!selectedTemplate && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3">
              <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-amber-800 dark:text-amber-200">Select a template in step 1 before generating.</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <button
              type="submit"
              disabled={generating || applying || !selectedTemplate}
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
              disabled={generating || applying || !formHasContent}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.03] hover:bg-slate-50 dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 font-semibold px-6 py-3.5 rounded-xl transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          </div>

          {generating && (
            <ResumeThinkingProgress phase={streamPhase} jobTitle={form.jobTitle} />
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

      {/* Step 3: Review */}
      {showReview && (
        <div ref={reviewRef} className="pt-8 border-t border-slate-200 dark:border-white/[0.06]">
          {step === "done" && docxBase64 && (
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-green-500/25 bg-gradient-to-r from-green-500/[0.08] to-emerald-500/[0.05] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-200">Resume ready</p>
                  <p className="text-sm text-green-700/80 dark:text-green-300/80">{fileName}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setPreviewOpen(true)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-white/10 border border-green-500/20 text-green-800 dark:text-green-200 hover:bg-green-50 dark:hover:bg-white/[0.08] transition-all">
                  Preview
                </button>
                <button type="button" onClick={handleDownload} className="px-4 py-2 rounded-xl text-sm font-semibold bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20 transition-all">
                  Download .docx
                </button>
                <button type="button" onClick={handleStartOver} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all">
                  Start over
                </button>
              </div>
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
            {(atsScore || atsLoading) && (
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
                {atsLoading ? "Scoring…" : atsScore ? `ATS ${atsScore.overall}/100` : "ATS Report"}
              </button>
            )}
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
              templateName={selectedTemplate?.name ?? ""}
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
        jobTitle={form.jobTitle}
        score={atsScore}
        loading={atsLoading}
        error={atsError}
        onRecheck={content ? () => evaluateAts(content) : undefined}
        recheckDisabled={atsLoading || generating || applying || !content}
        content={content}
        onContentChange={setContent}
        onApply={handleApply}
        onRegenerate={handleRegenerate}
        applying={applying}
        generating={generating}
        streamPhase={streamPhase}
        generateError={error}
        templateName={selectedTemplate?.name ?? ""}
        applyLabel={step === "done" ? "Re-apply changes" : "Apply to resume"}
        generationKey={generationKey}
      />

      <DocxPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={selectedTemplate?.name ?? "Template preview"}
        subtitle="Tailored resume · same template layout and styling as your base file"
        sourceUrl={previewSourceUrl}
        fileName={fileName}
        onDownload={handleDownload}
      />
    </>
  );
}
