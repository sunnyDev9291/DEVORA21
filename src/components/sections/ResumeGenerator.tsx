"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import ResumeRawAiTextarea from "@/components/ui/ResumeRawAiTextarea";
import CopyIconButton from "@/components/ui/CopyIconButton";
import ResumeContentReview from "@/components/sections/ResumeContentReview";
import { resolveResumeWizardStep } from "@/components/sections/ResumeStepper";
import { useAuth } from "@/context/AuthContext";
import type { UserResumeTemplateAsset } from "@/lib/profile-api";
import type { ResumeGenerationPhase } from "@/lib/resume-prompt";
import { generateResume } from "@/lib/resume-generate-client";
import { scrapeJobFromUrl } from "@/lib/job-scrape-api";
import { iterateJobCheckStream } from "@/lib/job-check-stream";
import JobCheckBoard from "@/components/ui/JobCheckBoard";
import { archiveResume } from "@/lib/resume-archive";
import { notifyTodaysResumeCountChanged } from "@/lib/todays-resume-count";
import { formatElapsedMs } from "@/lib/format-elapsed";
import {
  clearResumeGenerateTimer,
  publishResumeGenerateTimer,
} from "@/lib/resume-generate-timer";
import { resumeBuilderAccessDeniedMessage } from "@/lib/resume-access";
import { ApiError } from "@/lib/auth-api";
import { buildUnifiedResumeScore } from "@/lib/resume-unified-score";
import { emptyRuleKeepScore } from "@/lib/resume-rule-keep";
import type { ResumeScoreResult } from "@/lib/resume-score";
import { buildJobKeywordsCacheKey } from "@/lib/resume-keywords-cache";
import type {
  GeneratedResumeContent,
  ResumeBuildResponse,
  ResumeUnifiedScoreResult,
  AtsScoreResult,
  RuleKeepScoreResult,
} from "@/lib/resume-types";
import {
  computeFeedbackResolution,
  computeResumeContentDiff,
  type FeedbackResolution,
  type ResumeFieldChange,
} from "@/lib/resume-content-diff";
import {
  buildImproveTargetInstruction,
  type ResumeImproveTarget,
} from "@/lib/resume-improve-target";
import {
  normalizeResumeFileBaseName,
  buildExpectedResumeBaseName,
  extractResumeTitleHeadline,
} from "@/lib/resume-filename";
import { loadStoredProfile, resolveUserNames } from "@/lib/user-profile";
import CompanyPastApplications from "@/components/sections/CompanyPastApplications";
import type { SavedResumeArchive } from "@/lib/saved-resumes-types";

/**
 * Prefer the template resolved by useUserProfileAssets (remote-synced).
 * Fall back to localStorage only when the hook has not provided a template yet
 * (offline / API unavailable), so another device's upload is not blocked forever.
 */
function resolveActiveUserTemplate(
  userId: string | undefined,
  userTemplate: UserResumeTemplateAsset | null
): UserResumeTemplateAsset | null {
  if (userTemplate?.templateBase64?.trim() && userTemplate.fileName?.trim()) {
    return userTemplate;
  }
  const stored = userId ? loadStoredProfile(userId) : null;
  if (stored?.resumeTemplateBase64?.trim() && stored.resumeTemplateFileName?.trim()) {
    return {
      fileName: stored.resumeTemplateFileName,
      templateBase64: stored.resumeTemplateBase64,
    };
  }
  return null;
}

const PdfPreviewModal = dynamic(() => import("@/components/ui/PdfPreviewModal"), { ssr: false });
const ResumeAtsScoreModal = dynamic(() => import("@/components/ui/ResumeAtsScoreModal"));
const ResumeChatDialog = dynamic(() => import("@/components/ui/ResumeChatDialog"));

interface ResumeGeneratorProps {
  userTemplate: UserResumeTemplateAsset | null;
  userPrompt: string;
  onWizardStepChange?: (step: number) => void;
}

type Step = "form" | "review" | "done";

import { ui } from "@/lib/ui-styles";

const inputClass = ui.input;

// Keep the scoring code available, but disable the feature in the UI and network flow.
const RESUME_SCORE_SYSTEM_ENABLED = false;

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
  onWizardStepChange,
}: ResumeGeneratorProps) {
  const { user } = useAuth();
  const chatProfile = useMemo(() => {
    if (!user?.id) return undefined;
    const names = resolveUserNames(user, loadStoredProfile(user.id));
    return {
      fullName: names.fullName,
      firstName: names.firstName,
      lastName: names.lastName,
      email: user.email,
    };
  }, [user]);

  const activeTemplate = useMemo(
    () => resolveActiveUserTemplate(user?.id, userTemplate),
    [user?.id, userTemplate?.fileName, userTemplate?.templateBase64]
  );

  const [form, setForm] = useState({
    jobLink: "",
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
  const [importingJob, setImportingJob] = useState(false);
  const [jobFetchWarning, setJobFetchWarning] = useState("");
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generationKey, setGenerationKey] = useState(0);
  const [resumeFileBaseName, setResumeFileBaseName] = useState("");
  const [resumeNameTouched, setResumeNameTouched] = useState(false);
  const [streamPhase, setStreamPhase] = useState<ResumeGenerationPhase>("starting");
  const [streamOutput, setStreamOutput] = useState("");
  /** Frozen when draft is ready. */
  const [lastGenerateDurationMs, setLastGenerateDurationMs] = useState<number | null>(null);
  const generateStartedAtRef = useRef<number | null>(null);
  const [resumeScore, setResumeScore] = useState<ResumeUnifiedScoreResult | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState("");
  const [regenerateNotice, setRegenerateNotice] = useState("");
  const [regenerateBaseline, setRegenerateBaseline] = useState<GeneratedResumeContent | null>(null);
  const [regenerateBaselineScore, setRegenerateBaselineScore] = useState<ResumeUnifiedScoreResult | null>(null);
  const [improvingTargetId, setImprovingTargetId] = useState("");
  const [improvingTargetLabel, setImprovingTargetLabel] = useState("");
  const [atsModalOpen, setAtsModalOpen] = useState(false);
  const [resumeChatOpen, setResumeChatOpen] = useState(false);
  const [jobCheckOpen, setJobCheckOpen] = useState(false);
  const [jobChecking, setJobChecking] = useState(false);
  const [jobCheckOutput, setJobCheckOutput] = useState("");
  const [jobCheckError, setJobCheckError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const jobCheckAbortRef = useRef<AbortController | null>(null);
  const atsAbortRef = useRef<AbortController | null>(null);
  const generationRunRef = useRef(0);
  const keywordsCacheKeyRef = useRef<string | null>(null);
  const ruleKeepAbortRef = useRef<AbortController | null>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const successBannerRef = useRef<HTMLDivElement>(null);
  const reviewScrollTriggerRef = useRef({ step, generationKey });
  const promptPrefsLoadedRef = useRef(false);

  useEffect(() => {
    setForm((prev) => ({ ...prev, customPrompt: userPrompt }));
    promptPrefsLoadedRef.current = true;
  }, [userPrompt]);

  const wizardStep = resolveResumeWizardStep({
    hasTemplate: !!activeTemplate,
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
    setStreamOutput("");
    setLastGenerateDurationMs(null);
    generateStartedAtRef.current = null;
    clearResumeGenerateTimer();
    setResumeScore(null);
    setScoreError("");
    setRegenerateNotice("");
    setRegenerateBaseline(null);
    setRegenerateBaselineScore(null);
    setImprovingTargetId("");
    setImprovingTargetLabel("");
    setAtsModalOpen(false);
    setResumeChatOpen(false);
    setResumeFileBaseName("");
    setResumeNameTouched(false);
    keywordsCacheKeyRef.current = null;
  }, [activeTemplate?.fileName, activeTemplate?.templateBase64]);

  useEffect(() => {
    keywordsCacheKeyRef.current = null;
    setResumeScore(null);
    setScoreError("");
  }, [form.jobTitle, form.companyName, form.jobDescription, form.customPrompt]);

  useEffect(() => () => {
    abortRef.current?.abort();
    atsAbortRef.current?.abort();
    jobCheckAbortRef.current?.abort();
    clearResumeGenerateTimer();
  }, []);

  useEffect(() => {
    if (!generating) return;
    const startedAt = generateStartedAtRef.current ?? Date.now();
    generateStartedAtRef.current = startedAt;
    const tick = () => {
      const elapsedMs = Date.now() - startedAt;
      publishResumeGenerateTimer({ active: true, elapsedMs });
    };
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [generating]);

  useEffect(() => {
    const prev = reviewScrollTriggerRef.current;
    const generationChanged = generationKey !== prev.generationKey;
    const enteredReview = step === "review" && prev.step !== "review";
    reviewScrollTriggerRef.current = { step, generationKey };

    if ((generationChanged || enteredReview) && step === "review" && content) {
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

  async function handleImportJobLink() {
    if (generating || applying || importingJob) return;
    const url = form.jobLink.trim();
    if (!url) {
      setError("Paste a job link first.");
      return;
    }

    setError("");
    setJobFetchWarning("");
    setImportingJob(true);
    try {
      const data = await scrapeJobFromUrl(url);
      setForm((prev) => ({
        ...prev,
        jobTitle: data.jobTitle,
        companyName: data.companyName,
        jobDescription: data.jobDescription,
      }));

      const softNotes: string[] = [];
      if (data.warning?.trim()) softNotes.push(data.warning.trim());
      if (data.confidence === "low") {
        softNotes.push(
          "Low confidence scrape — review title, company, and description before generating."
        );
      }
      if (!data.jobTitle.trim()) {
        softNotes.push("Job title was not found — enter it manually.");
      }
      if (!data.companyName.trim()) {
        softNotes.push("Company name was not found — enter it manually.");
      }
      if (!data.jobDescription.trim()) {
        softNotes.push("Job description was incomplete — paste or edit it before generating.");
      }
      setJobFetchWarning(softNotes.join(" "));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(
          (err as Error).message ||
            "Could not fetch that job link. Paste the job description manually instead."
        );
      }
    } finally {
      setImportingJob(false);
    }
  }

  function handleClear() {
    if (generating || applying || importingJob) return;

    abortRef.current?.abort();
    atsAbortRef.current?.abort();

    setForm((prev) => ({
      ...prev,
      jobLink: "",
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
    setJobFetchWarning("");
    setStreamPhase("starting");
    setResumeScore(null);
    setScoreError("");
    setRegenerateNotice("");
    setRegenerateBaseline(null);
    setRegenerateBaselineScore(null);
    setImprovingTargetId("");
    setImprovingTargetLabel("");
    setAtsModalOpen(false);
    setResumeChatOpen(false);
    setResumeFileBaseName("");
    setResumeNameTouched(false);
    keywordsCacheKeyRef.current = null;
  }

  const hasClearableContent =
    !!form.jobLink.trim() ||
    !!form.jobTitle.trim() ||
    !!form.companyName.trim() ||
    !!form.jobDescription.trim() ||
    !!content ||
    step !== "form" ||
    !!docxBase64 ||
    !!pdfBase64;

  const targetJobLabel = `${form.jobTitle.trim()} at ${form.companyName.trim()}`;

  const canGenerate = !!activeTemplate && !!form.jobTitle.trim() && !!form.companyName.trim();
  const canJobCheck = !!form.companyName.trim();

  async function runJobCheck() {
    if (!canJobCheck || jobChecking) return;

    jobCheckAbortRef.current?.abort();
    const controller = new AbortController();
    jobCheckAbortRef.current = controller;

    setJobCheckOpen(true);
    setJobChecking(true);
    setJobCheckOutput("");
    setJobCheckError("");

    let streamed = "";
    try {
      for await (const chunk of iterateJobCheckStream(
        {
          jobTitle: form.jobTitle,
          companyName: form.companyName,
          jobDescription: form.jobDescription,
        },
        controller.signal
      )) {
        streamed += chunk;
        setJobCheckOutput(streamed);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setJobCheckError((err as Error).message || "Job Check failed.");
    } finally {
      if (jobCheckAbortRef.current === controller) {
        setJobChecking(false);
        jobCheckAbortRef.current = null;
      }
    }
  }

  const suggestedResumeBaseName = useMemo(() => {
    if (!content) return "";
    if (content.fileName?.trim()) {
      return normalizeResumeFileBaseName(content.fileName);
    }
    if (!activeTemplate) return "";
    return buildExpectedResumeBaseName(
      activeTemplate.fileName,
      content,
      form.customPrompt,
      chatProfile?.fullName
    );
  }, [content, activeTemplate, form.customPrompt, chatProfile?.fullName]);

  useEffect(() => {
    if (!resumeNameTouched && suggestedResumeBaseName) {
      setResumeFileBaseName(suggestedResumeBaseName);
    }
  }, [suggestedResumeBaseName, resumeNameTouched]);

  useEffect(() => {
    setResumeNameTouched(false);
    if (suggestedResumeBaseName) {
      setResumeFileBaseName(suggestedResumeBaseName);
    }
  }, [generationKey]); // eslint-disable-line react-hooks/exhaustive-deps -- reset manual name on new generation

  function syncKeywordsCacheKey() {
    if (!form.jobTitle.trim() || !form.companyName.trim()) return;
    keywordsCacheKeyRef.current = buildJobKeywordsCacheKey(
      form.jobTitle,
      form.companyName,
      form.jobDescription
    );
  }

  async function hydrateRuleKeepScores(
    resumeContent: GeneratedResumeContent,
    ats: AtsScoreResult
  ) {
    if (!RESUME_SCORE_SYSTEM_ENABLED) return;
    if (!form.customPrompt?.trim()) return;

    ruleKeepAbortRef.current?.abort();
    const controller = new AbortController();
    ruleKeepAbortRef.current = controller;

    try {
      const res = await fetch("/api/resume/score/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: resumeContent,
          customPrompt: form.customPrompt,
        }),
        signal: controller.signal,
      });
      const data = (await res.json()) as { ruleKeep?: RuleKeepScoreResult; error?: string };
      if (!res.ok || !data.ruleKeep || controller.signal.aborted) return;
      setResumeScore(buildUnifiedResumeScore(ats, data.ruleKeep));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
  }

  async function evaluateResumeScores(
    resumeContent: GeneratedResumeContent,
    options?: {
      openModal?: boolean;
      preserveScore?: boolean;
      reuseKeywords?: boolean;
      ruleKeepSnapshot?: RuleKeepScoreResult;
      /** Internal optimization pass — no loading UI or abort of in-flight scoring. */
      quiet?: boolean;
      /** Await slow Rule Keep audit (manual recheck). Default: ATS first, rules in background. */
      includeRuleKeep?: boolean;
    }
  ): Promise<ResumeUnifiedScoreResult | null> {
    if (!RESUME_SCORE_SYSTEM_ENABLED) return null;

    const controller = new AbortController();

    if (!options?.quiet) {
      atsAbortRef.current?.abort();
      atsAbortRef.current = controller;
      setScoreLoading(true);
      setScoreError("");
      if (!options?.preserveScore) {
        setResumeScore(null);
      }
      if (options?.openModal !== false) {
        setAtsModalOpen(true);
      }
    }

    syncKeywordsCacheKey();

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
          skipRuleKeep: true,
          ...(keywordsCacheKeyRef.current ? { keywordsCacheKey: keywordsCacheKeyRef.current } : {}),
          cachedRuleKeep: options?.ruleKeepSnapshot ?? emptyRuleKeepScore(),
        }),
        signal: controller.signal,
      });

      const data = (await res.json()) as ResumeScoreResult & { error?: string };

      if (!res.ok) {
        throw new Error(data?.error || `Scoring failed (${res.status}).`);
      }

      if (data.keywordsCacheKey) {
        keywordsCacheKeyRef.current = data.keywordsCacheKey;
      }

      const { keywordsCacheKey: _ignored, ...atsScore } = data;

      if (options?.includeRuleKeep && form.customPrompt?.trim()) {
        const rulesRes = await fetch("/api/resume/score/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: resumeContent,
            customPrompt: form.customPrompt,
          }),
          signal: controller.signal,
        });
        const rulesData = (await rulesRes.json()) as {
          ruleKeep?: RuleKeepScoreResult;
          error?: string;
        };
        if (!rulesRes.ok || !rulesData.ruleKeep) {
          throw new Error(rulesData?.error || `Rule scoring failed (${rulesRes.status}).`);
        }
        const merged = buildUnifiedResumeScore(atsScore.ats, rulesData.ruleKeep);
        if (!options?.quiet) {
          setResumeScore(merged);
        }
        return merged;
      }

      if (!options?.quiet) {
        setResumeScore(atsScore);
      }

      if (!options?.quiet && form.customPrompt?.trim()) {
        void hydrateRuleKeepScores(resumeContent, atsScore.ats);
      }

      return atsScore;
    } catch (err) {
      if ((err as Error).name === "AbortError") return null;
      if (!options?.quiet) {
        const message = (err as Error).message || "Could not evaluate resume scores.";
        setScoreError(message);
      }
      return null;
    } finally {
      if (!options?.quiet && !controller.signal.aborted) {
        setScoreLoading(false);
      }
    }
  }

  async function handleGenerate(e?: React.FormEvent) {
    e?.preventDefault();
    if (applying) return;
    if (!user?.id) {
      setError(
        "Authentication required so the profile prompt can be applied. Sign in again, then retry Generate."
      );
      return;
    }
    if (!activeTemplate) {
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
    setRegenerateBaseline(null);
    setRegenerateBaselineScore(null);
    setImprovingTargetId("");
    setImprovingTargetLabel("");
    setGenerating(true);
    setStreamPhase("starting");
    setStreamOutput("");
    setContent(null);
    generateStartedAtRef.current = Date.now();
    setLastGenerateDurationMs(null);
    publishResumeGenerateTimer({ active: true, elapsedMs: 0 });

    const controller = new AbortController();
    abortRef.current = controller;
    syncKeywordsCacheKey();

    const templateForRequest = resolveActiveUserTemplate(user?.id, activeTemplate)!;

    try {
      setDocxBase64("");
      setFileName("");
      setStep("review");

      const data = await generateResume(
        {
          ...form,
          templateName: templateForRequest.fileName,
          templateBase64: templateForRequest.templateBase64,
          profileName: chatProfile?.fullName,
          userId: user?.id,
        },
        {
          onPhase: (phase) => {
            if (generationRunRef.current === runId) setStreamPhase(phase);
          },
          onOutput: (_chunk, full) => {
            if (generationRunRef.current === runId) setStreamOutput(full);
          },
          signal: controller.signal,
        }
      );

      if (generationRunRef.current !== runId) return;
      const endedAt = Date.now();
      const startedAt = generateStartedAtRef.current ?? endedAt;
      const durationMs = endedAt - startedAt;
      setLastGenerateDurationMs(durationMs);
      publishResumeGenerateTimer({ active: true, elapsedMs: durationMs });
      setContent(data.content);
      setGenerationKey((k) => k + 1);
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

  async function handleImproveScoreItem(target: ResumeImproveTarget) {
    if (!RESUME_SCORE_SYSTEM_ENABLED) return;
    if (applying || generating || !content || !activeTemplate) return;
    if (!user?.id) {
      setError(
        "Authentication required so the profile prompt can be applied. Sign in again, then retry Generate."
      );
      return;
    }

    setAtsModalOpen(true);
    setScoreError("");

    const baselineScore =
      resumeScore ?? (await evaluateResumeScores(content, { openModal: true, includeRuleKeep: true }));
    if (!baselineScore) return;

    abortRef.current?.abort();
    const runId = ++generationRunRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setImprovingTargetId(target.id);
    setImprovingTargetLabel(target.label);
    setStreamPhase("starting");
    setStreamOutput("");
    setError("");
    setRegenerateNotice("");
    setRegenerateBaseline(content);
    setRegenerateBaselineScore(baselineScore);
    generateStartedAtRef.current = Date.now();
    setLastGenerateDurationMs(null);
    publishResumeGenerateTimer({ active: true, elapsedMs: 0 });

    const templateForRequest = resolveActiveUserTemplate(user?.id, activeTemplate)!;
    const targetedInstruction = buildImproveTargetInstruction(target);

    try {
      const draft = await generateResume(
        {
          ...form,
          customPrompt: form.customPrompt,
          task: targetedInstruction,
          templateName: templateForRequest.fileName,
          templateBase64: templateForRequest.templateBase64,
          profileName: chatProfile?.fullName,
          userId: user?.id,
          previousContent: content,
          atsFeedback: baselineScore.ats,
          ruleKeepFeedback: baselineScore.ruleKeep,
        },
        {
          onPhase: (phase) => {
            if (generationRunRef.current === runId) setStreamPhase(phase);
          },
          onOutput: (_chunk, full) => {
            if (generationRunRef.current === runId) setStreamOutput(full);
          },
          signal: controller.signal,
        }
      );

      if (generationRunRef.current !== runId) return;

      const endedAt = Date.now();
      const startedAt = generateStartedAtRef.current ?? endedAt;
      const durationMs = endedAt - startedAt;
      setLastGenerateDurationMs(durationMs);
      publishResumeGenerateTimer({ active: true, elapsedMs: durationMs });

      const nextScore = await evaluateResumeScores(draft.content, {
        openModal: false,
        preserveScore: true,
        quiet: true,
        includeRuleKeep: target.kind === "custom-rule",
        ruleKeepSnapshot: target.kind === "custom-rule" ? undefined : baselineScore.ruleKeep,
      });

      if (generationRunRef.current !== runId) return;
      setContent(draft.content);
      setGenerationKey((k) => k + 1);
      if (nextScore) {
        setResumeScore(nextScore);
        setRegenerateNotice(
          `Improved "${target.label}" — overall ${baselineScore.overall}→${nextScore.overall}/100.`
        );
        if (target.kind !== "custom-rule" && form.customPrompt?.trim()) {
          void hydrateRuleKeepScores(draft.content, nextScore.ats);
        }
      } else {
        setRegenerateNotice(`Updated "${target.label}". Re-check the score to verify the improvement.`);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (generationRunRef.current !== runId) return;
      setError((err as Error).message || "Could not improve this score item.");
    } finally {
      if (generationRunRef.current === runId) {
        setGenerating(false);
        setImprovingTargetId("");
        setImprovingTargetLabel("");
        abortRef.current = null;
      }
    }
  }

  async function submitResumeArchive(docxB64: string, resumeFileName: string) {
    setArchiving(true);
    setArchiveError("");
    setPdfBase64("");
    setPdfFileName("");

    try {
      const docxBlob = base64ToBlob(docxB64, DOCX_MIME);
      const result = await archiveResume({
        jobTitle: content ? extractResumeTitleHeadline(content.title) : form.jobTitle,
        companyName: form.companyName,
        jobDescription: form.jobDescription,
        docxBlob,
        fileName: resumeFileName,
      });
      setPdfBase64(result.pdfBase64);
      setPdfFileName(result.pdfFileName);
      notifyTodaysResumeCountChanged();
    } catch (err) {
      setArchiveError(resumeBuilderAccessDeniedMessage(err));
    } finally {
      setArchiving(false);
    }
  }

  async function handleApply() {
    if (!content || !activeTemplate || applying) return;
    const templateForRequest = resolveActiveUserTemplate(user?.id, activeTemplate);
    if (!templateForRequest) return;

    setError("");
    setApplying(true);
    try {
      const res = await fetch("/api/resume/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: templateForRequest.fileName,
          templateBase64: templateForRequest.templateBase64,
          customPrompt: form.customPrompt,
          content,
          resumeFileBaseName: resumeFileBaseName.trim(),
          profileName: chatProfile?.fullName,
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
      if (RESUME_SCORE_SYSTEM_ENABLED) {
        void evaluateResumeScores(content, { openModal: false });
      }
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
    setResumeScore(null);
    setScoreError("");
    setRegenerateNotice("");
    setRegenerateBaseline(null);
    setRegenerateBaselineScore(null);
    setImprovingTargetId("");
    setImprovingTargetLabel("");
    setAtsModalOpen(false);
    setResumeChatOpen(false);
    setResumeFileBaseName("");
    setResumeNameTouched(false);
    keywordsCacheKeyRef.current = null;
    atsAbortRef.current?.abort();
  }

  const pdfBlob = useMemo(
    () => (pdfBase64 ? base64ToBlob(pdfBase64, PDF_MIME) : null),
    [pdfBase64]
  );

  const regenerateChanges = useMemo(() => {
    if (!regenerateBaseline || !content) return [];
    return computeResumeContentDiff(regenerateBaseline, content);
  }, [regenerateBaseline, content]);

  const regenerateFeedback = useMemo(() => {
    if (!regenerateBaselineScore || !resumeScore) return null;
    return computeFeedbackResolution(regenerateBaselineScore, resumeScore);
  }, [regenerateBaselineScore, resumeScore]);

  const changedFieldIds = useMemo(
    () => new Set(regenerateChanges.map((change) => change.id)),
    [regenerateChanges]
  );

  const canPreviewPdf = !!pdfBlob && !archiving;

  const showReview = step !== "form" && (Boolean(content) || generating || Boolean(streamOutput));
  const showStructuredReview = Boolean(content) && !generating;

  return (
    <>
      {/* Step 2: Job details */}
      <div className={`transition-all duration-300 ${showReview ? "mb-8" : ""}`}>
        <div className="flex items-center gap-3 mb-5">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400 text-sm font-bold">2</span>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Target job details</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tell the AI what role you&apos;re applying for</p>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label htmlFor="jobLink" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Job link
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="jobLink"
                name="jobLink"
                type="url"
                value={form.jobLink}
                onChange={handleChange}
                placeholder="https://boards.greenhouse.io/… or Lever / Ashby careers URL"
                className={`${inputClass} flex-1 min-w-0`}
                disabled={generating || applying || importingJob}
              />
              <div className="flex shrink-0 gap-2">
                <CopyIconButton
                  text={form.jobLink}
                  label="Copy job link"
                  disabled={generating || applying || importingJob}
                />
                <button
                  type="button"
                  onClick={() => void handleImportJobLink()}
                  disabled={generating || applying || importingJob || !form.jobLink.trim()}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-3 text-sm font-semibold transition-all"
                >
                  {importingJob ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Applying…
                    </>
                  ) : (
                    "Apply"
                  )}
                </button>
              </div>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Apply fills job title, company name, and description from the posting, then you can generate the AI draft.
            </p>
            {jobFetchWarning && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2.5">
                <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-amber-800 dark:text-amber-200">{jobFetchWarning}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="jobTitle" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Job title <span className="text-red-400">*</span>
              </label>
              <div className="flex items-stretch gap-2">
                <input
                  id="jobTitle"
                  name="jobTitle"
                  type="text"
                  value={form.jobTitle}
                  onChange={handleChange}
                  placeholder="e.g. Senior Backend Engineer"
                  className={`${inputClass} min-w-0 flex-1`}
                  required
                />
                <CopyIconButton text={form.jobTitle} label="Copy job title" disabled={generating} />
              </div>
            </div>
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Company name <span className="text-red-400">*</span>
              </label>
              <div className="flex items-stretch gap-2">
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  value={form.companyName}
                  onChange={handleChange}
                  placeholder="e.g. Acme Corp"
                  className={`${inputClass} min-w-0 flex-1`}
                  required
                  autoComplete="organization"
                />
                <CopyIconButton text={form.companyName} label="Copy company name" disabled={generating} />
              </div>
              <CompanyPastApplications
                companyName={form.companyName}
                disabled={generating || applying}
                onUseJobDescription={(item: SavedResumeArchive) => {
                  setForm((current) => ({
                    ...current,
                    jobTitle: item.jobTitle?.trim() || current.jobTitle,
                    companyName: item.companyName?.trim() || current.companyName,
                    jobDescription: item.jobDescription?.trim() || current.jobDescription,
                  }));
                }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="jobDescription" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Job description
            </label>
            <div className="flex items-start gap-2">
              <textarea
                id="jobDescription"
                name="jobDescription"
                value={form.jobDescription}
                onChange={handleChange}
                placeholder="Paste the full job posting for better keyword matching…"
                className={`${inputClass} h-[260px] max-h-[260px] min-w-0 flex-1 resize-none overflow-y-auto`}
              />
              <CopyIconButton
                text={form.jobDescription}
                label="Copy job description"
                disabled={generating}
                className="h-12 self-start"
              />
            </div>
          </div>

          {userPrompt.trim() && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Private writing instructions from your profile are applied automatically. Prompt content is never displayed.
            </p>
          )}

          {!activeTemplate && (
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
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-tomato-600 to-sun-400 hover:from-tomato-500 hover:to-sun-300 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-orange-500/25 hover:shadow-blue-500/30 hover:-translate-y-px"
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
                  Generate new draft
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
              onClick={() => void runJobCheck()}
              disabled={generating || applying || jobChecking || !canJobCheck}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/15 disabled:opacity-50 disabled:cursor-not-allowed text-sky-800 dark:text-sky-200 font-semibold px-6 py-3.5 rounded-xl transition-all"
            >
              {jobChecking ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Checking job…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Job Check
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
        </form>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3">
          <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-300 whitespace-pre-wrap">{error}</p>
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

      {/* Step 3: Raw stream + structured review */}
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
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {generating ? "Receiving AI draft" : "Edit your draft"}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {generating
                    ? "Raw stream fills first — structured fields appear when complete"
                    : lastGenerateDurationMs != null
                      ? `Review every field, then apply to your template · generated in ${formatElapsedMs(lastGenerateDurationMs)}`
                      : "Review every field, then apply to your template"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {RESUME_SCORE_SYSTEM_ENABLED && (resumeScore || scoreLoading) && (
                <button
                  type="button"
                  onClick={() => setAtsModalOpen(true)}
                  className={`inline-flex items-center gap-2 shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                    resumeScore?.passed
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15"
                      : resumeScore
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15"
                        : "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  {scoreLoading
                    ? "Scoring…"
                    : resumeScore
                      ? `Score ${resumeScore.overall}/100`
                      : "Score report"}
                </button>
              )}
              {content && (
                <button
                  type="button"
                  onClick={() => setResumeChatOpen(true)}
                  className="inline-flex items-center gap-2 shrink-0 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm font-semibold text-orange-700 transition-all hover:bg-orange-500/15 dark:text-orange-300"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Application Q&A
                </button>
              )}
            </div>
          </div>

          {(generating || streamOutput) && (
            <div className="mb-6">
              <ResumeRawAiTextarea
                value={streamOutput}
                streaming={generating}
              />
            </div>
          )}

          {RESUME_SCORE_SYSTEM_ENABLED && atsModalOpen ? (
            <div className="rounded-2xl border border-dashed border-violet-500/25 bg-violet-500/[0.04] px-5 py-8 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                Your draft and ATS score are open in the review panel.
              </p>
              <button
                type="button"
                onClick={() => setAtsModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-500 transition-all"
              >
                Open review panel
              </button>
            </div>
          ) : showStructuredReview && content ? (
            <ResumeContentReview
              content={content}
              onChange={setContent}
              onApply={handleApply}
              applying={applying}
              generating={generating}
              templateName={activeTemplate?.fileName ?? ""}
              resumeFileBaseName={resumeFileBaseName}
              suggestedResumeBaseName={suggestedResumeBaseName}
              onResumeFileBaseNameChange={(value, options) => {
                if (options?.markTouched !== false) setResumeNameTouched(true);
                setResumeFileBaseName(value);
              }}
              onResumeFileBaseNameReset={() => {
                setResumeNameTouched(false);
                setResumeFileBaseName(suggestedResumeBaseName);
              }}
              applyLabel={step === "done" ? "Re-apply changes" : "Apply to resume"}
              generationKey={generationKey}
              regenerateChanges={regenerateChanges}
              regenerateFeedback={regenerateFeedback}
              changedFieldIds={changedFieldIds}
              onDismissRegenerateDiff={() => {
                setRegenerateBaseline(null);
                setRegenerateBaselineScore(null);
              }}
            />
          ) : generating ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] px-6 py-8 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Title, summary, skillsets, and experience will fill here automatically once the raw JSON stream finishes.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {!showReview && !generating && (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] px-6 py-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            After you generate, step 3 opens here — edit title, summary, skills, and experience before anything is written to your file.
          </p>
        </div>
      )}

      {RESUME_SCORE_SYSTEM_ENABLED && (
        <ResumeAtsScoreModal
          open={atsModalOpen}
          onClose={() => setAtsModalOpen(false)}
          jobTitle={targetJobLabel}
          score={resumeScore}
          loading={scoreLoading}
          error={scoreError}
          onRecheck={content ? () => evaluateResumeScores(content, { includeRuleKeep: true }) : undefined}
          recheckDisabled={scoreLoading || generating || applying || !content}
          content={content}
          onContentChange={setContent}
          onApply={handleApply}
          applying={applying}
          generating={generating}
          streamPhase={streamPhase}
          streamOutput={streamOutput}
          generateError={error}
          regenerateNotice={regenerateNotice}
          templateName={userTemplate?.fileName ?? ""}
          customPrompt={form.customPrompt}
          resumeFileBaseName={resumeFileBaseName}
          suggestedResumeBaseName={suggestedResumeBaseName}
          onResumeFileBaseNameChange={(value, options) => {
            if (options?.markTouched !== false) setResumeNameTouched(true);
            setResumeFileBaseName(value);
          }}
          onResumeFileBaseNameReset={() => {
            setResumeNameTouched(false);
            setResumeFileBaseName(suggestedResumeBaseName);
          }}
          applyLabel={step === "done" ? "Re-apply changes" : "Apply to resume"}
          generationKey={generationKey}
          onOpenResumeChat={() => setResumeChatOpen(true)}
          regenerateChanges={regenerateChanges}
          regenerateFeedback={regenerateFeedback}
          changedFieldIds={changedFieldIds}
          onDismissRegenerateDiff={() => {
            setRegenerateBaseline(null);
            setRegenerateBaselineScore(null);
          }}
          onImprove={handleImproveScoreItem}
          improvingTargetId={improvingTargetId}
          improvingTargetLabel={improvingTargetLabel}
        />
      )}

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

      <JobCheckBoard
        open={jobCheckOpen}
        loading={jobChecking}
        error={jobCheckError}
        output={jobCheckOutput}
        jobTitle={form.jobTitle}
        companyName={form.companyName}
        onClose={() => {
          jobCheckAbortRef.current?.abort();
          jobCheckAbortRef.current = null;
          setJobCheckOpen(false);
          setJobChecking(false);
        }}
        onRetry={() => void runJobCheck()}
      />

      <ResumeChatDialog
        open={resumeChatOpen}
        onClose={() => setResumeChatOpen(false)}
        content={content}
        profile={chatProfile}
        jobTitle={form.jobTitle}
        companyName={form.companyName}
        jobDescription={form.jobDescription}
        generationKey={generationKey}
      />
    </>
  );
}
