"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import JobCheckBoard from "@/components/ui/JobCheckBoard";
import ResumeFromJobProgress from "@/components/ui/ResumeFromJobProgress";
import { ApiError, getApiErrorMessage } from "@/lib/auth-api";
import {
  getResumeFromJobStatus,
  isResumeFromJobTerminal,
  mergeResumeFromJobSteps,
  RESUME_FROM_JOB_POLL_MS,
  RESUME_FROM_JOB_TIMEOUT_MS,
  resolveResumeFromJobResult,
  startResumeFromJob,
  throwIfEnglishTeamRequiredJob,
  type ResumeFromJobJob,
  type ResumeFromJobResult,
} from "@/lib/resume-from-job-api";
import { iterateJobCheckStream } from "@/lib/job-check-stream";
import { isEnglishTeamRequiredError } from "@/lib/english-team-gate";
import EnglishTeamRequiredDialog from "@/components/ui/EnglishTeamRequiredDialog";
import { profileApi } from "@/lib/profile-api";
import { useAuth } from "@/context/AuthContext";
import { loadStoredProfile, resolveUserNames } from "@/lib/user-profile";
import { scrapeJobFromUrl } from "@/lib/job-scrape-api";
import { resolveResumeChatContent } from "@/lib/resume-chat-prompt";
import type { GeneratedResumeContent } from "@/lib/resume-types";

const PdfPreviewModal = dynamic(() => import("@/components/ui/PdfPreviewModal"), { ssr: false });
const ResumeChatDialog = dynamic(() => import("@/components/ui/ResumeChatDialog"));

const inputClass =
  "w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.10] hover:border-slate-300 dark:hover:border-white/[0.16] focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm outline-none transition-all";

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResumeFromJobPanel() {
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

  const [jobUrl, setJobUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<ResumeFromJobJob | null>(null);
  const [result, setResult] = useState<ResumeFromJobResult | null>(null);
  const [chatContent, setChatContent] = useState<GeneratedResumeContent | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [resumeChatOpen, setResumeChatOpen] = useState(false);
  const [generationKey, setGenerationKey] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [englishTeamGateOpen, setEnglishTeamGateOpen] = useState(false);
  const [englishTeamGateMessage, setEnglishTeamGateMessage] = useState("");
  const [englishTeamContinuing, setEnglishTeamContinuing] = useState(false);
  const [jobCheckOpen, setJobCheckOpen] = useState(false);
  const [jobChecking, setJobChecking] = useState(false);
  const [jobCheckOutput, setJobCheckOutput] = useState("");
  const [jobCheckError, setJobCheckError] = useState("");
  const jobCheckAbortRef = useRef<AbortController | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);
  const downloadUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      jobCheckAbortRef.current?.abort();
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (downloadUrlRef.current) {
        URL.revokeObjectURL(downloadUrlRef.current);
        downloadUrlRef.current = null;
      }
    };
  }, []);

  const steps = useMemo(
    () => mergeResumeFromJobSteps(job?.steps, job?.status ?? "queued"),
    [job?.steps, job?.status]
  );

  const progressPercent = job?.progressPercent ?? (job?.status === "done" ? 100 : 0);
  const pdfBlob = useMemo(
    () => (result?.pdfBase64 ? base64ToBlob(result.pdfBase64, "application/pdf") : null),
    [result?.pdfBase64]
  );

  const pdfDownloadUrl = useMemo(() => {
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = null;
    }
    if (!pdfBlob) return null;
    const url = URL.createObjectURL(pdfBlob);
    downloadUrlRef.current = url;
    return url;
  }, [pdfBlob]);

  const jobTitle = result?.jobTitle || job?.jobTitle || "";
  const companyName = result?.companyName || job?.companyName || "";
  const canOpenResumeChat = Boolean(
    resolveResumeChatContent({
      content: chatContent,
      jobTitle,
      companyName,
    })
  );

  useEffect(() => {
    if (!result?.pdfBase64) return;
    successRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [result?.pdfBase64]);

  function clearPollTimer() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  function stopRun() {
    abortRef.current?.abort();
    abortRef.current = null;
    clearPollTimer();
    setRunning(false);
  }

  async function hydrateChatContext(jobSnapshot: ResumeFromJobJob, resolved: ResumeFromJobResult) {
    const title = resolved.jobTitle || jobSnapshot.jobTitle || "";
    const company = resolved.companyName || jobSnapshot.companyName || "";
    let description =
      resolved.jobDescription || jobSnapshot.jobDescription || jobSnapshot.result?.jobDescription || "";
    const content =
      resolved.content || jobSnapshot.content || jobSnapshot.result?.content || null;

    const url = (jobSnapshot.url || jobUrl).trim();
    if ((!description.trim() || !content) && url) {
      try {
        const scraped = await scrapeJobFromUrl(url);
        if (!description.trim() && scraped.jobDescription.trim()) {
          description = scraped.jobDescription.trim();
        }
      } catch {
        // Q&A can still open with title/company/profile if scrape fails.
      }
    }

    const nextContent = resolveResumeChatContent({
      content,
      jobTitle: title,
      companyName: company,
    });

    setChatContent(nextContent);
    setJobDescription(description);
    setGenerationKey((k) => k + 1);
    if (nextContent) setResumeChatOpen(true);
  }

  async function finishWithResult(jobSnapshot: ResumeFromJobJob, signal: AbortSignal) {
    const resolved = await resolveResumeFromJobResult(jobSnapshot, signal);
    setResult(resolved);
    setJob((prev) =>
      prev
        ? {
            ...prev,
            status: "done",
            progressPercent: 100,
            message: "PDF ready — download below.",
            jobTitle: resolved.jobTitle || prev.jobTitle,
            companyName: resolved.companyName || prev.companyName,
            jobDescription: resolved.jobDescription || prev.jobDescription,
            content: resolved.content || prev.content,
            warning: resolved.warning || prev.warning,
          }
        : prev
    );
    await hydrateChatContext(jobSnapshot, resolved);
  }

  async function pollUntilDone(jobId: string, startedAt: number, signal: AbortSignal) {
    while (!signal.aborted) {
      if (Date.now() - startedAt > RESUME_FROM_JOB_TIMEOUT_MS) {
        throw new Error(
          "Timed out after 12 minutes. The job may still finish on the server — check Saved resumes shortly."
        );
      }

      const latest = await getResumeFromJobStatus(jobId, signal);
      setJob(latest);

      if (latest.status === "done") {
        await finishWithResult(latest, signal);
        return;
      }

      if (latest.status === "error") {
        throwIfEnglishTeamRequiredJob(latest);
        throw new Error(latest.error || latest.message || "Resume generation failed.");
      }

      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          clearPollTimer();
          reject(new DOMException("Aborted", "AbortError"));
        };
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
        pollTimerRef.current = setTimeout(() => {
          signal.removeEventListener("abort", onAbort);
          pollTimerRef.current = null;
          resolve();
        }, RESUME_FROM_JOB_POLL_MS);
      });
    }
  }

  async function runJobCheck() {
    const company = (job?.companyName || result?.companyName || "").trim();
    if (!company || jobChecking) {
      setJobCheckOpen(true);
      setJobCheckError(
        company
          ? "Job Check is already running."
          : "Company name is not available yet for Job Check."
      );
      return;
    }

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
          jobTitle: job?.jobTitle || result?.jobTitle || "",
          companyName: company,
          jobDescription: jobDescription || job?.url || jobUrl,
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

  async function handleGenerate(
    e?: React.FormEvent,
    options?: { skipEnglishTeamGate?: boolean }
  ) {
    e?.preventDefault();
    if (running) return;

    const url = jobUrl.trim();
    if (!url) {
      setError("Paste a job link first.");
      return;
    }

    const skipEnglishTeamGate = Boolean(options?.skipEnglishTeamGate);

    try {
      await profileApi.requireStoredPrompt();
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "Profile prompt not found. Upload a prompt in your Devora21 profile before generating a resume."
        )
      );
      return;
    }

    abortRef.current?.abort();
    clearPollTimer();
    const controller = new AbortController();
    abortRef.current = controller;

    setError("");
    setEnglishTeamGateOpen(false);
    setEnglishTeamGateMessage("");
    setEnglishTeamContinuing(false);
    setResult(null);
    setChatContent(null);
    setJobDescription("");
    setResumeChatOpen(false);
    setPreviewOpen(false);
    setRunning(true);
    setJob({
      jobId: "",
      status: "queued",
      message: "Starting…",
      progressPercent: 0,
    });

    const startedAt = Date.now();

    try {
      const started = await startResumeFromJob(url, controller.signal, {
        skipEnglishTeamGate,
      });
      setJob(started);
      if (!skipEnglishTeamGate) {
        throwIfEnglishTeamRequiredJob(started);
      }

      if (isResumeFromJobTerminal(started.status)) {
        if (started.status === "done") {
          await finishWithResult(started, controller.signal);
          return;
        }
        if (!skipEnglishTeamGate) {
          throwIfEnglishTeamRequiredJob(started);
        }
        throw new Error(started.error || started.message || "Resume generation failed.");
      }

      await pollUntilDone(started.jobId, startedAt, controller.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (isEnglishTeamRequiredError(err) && !skipEnglishTeamGate) {
        setResult(null);
        setChatContent(null);
        setPreviewOpen(false);
        setEnglishTeamGateMessage(err.message);
        setEnglishTeamGateOpen(true);
        setJob((prev) =>
          prev
            ? {
                ...prev,
                status: "error",
                code: err.code,
                answer: err.answer,
                workWithEnglishTeam: err.workWithEnglishTeam,
                message: err.message,
                error: err.message,
              }
            : {
                jobId: "",
                status: "error",
                code: err.code,
                answer: err.answer,
                workWithEnglishTeam: err.workWithEnglishTeam,
                message: err.message,
                error: err.message,
              }
        );
        return;
      }
      setError(getApiErrorMessage(err, (err as Error)?.message || "Resume generation failed."));
      setJob((prev) =>
        prev
          ? {
              ...prev,
              status: "error",
              message: err instanceof ApiError ? err.message : (err as Error)?.message || prev.message,
            }
          : prev
      );
    } finally {
      if (abortRef.current === controller) {
        setRunning(false);
        abortRef.current = null;
      }
      setEnglishTeamContinuing(false);
      clearPollTimer();
    }
  }

  function handleDownloadPdf() {
    if (!pdfBlob || !result) return;
    downloadBlob(pdfBlob, result.pdfFileName || "resume.pdf");
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
          One-shot · Job link → PDF
        </p>
        <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
          Generate resume from job link
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Backend scrapes the posting, fills your template, and returns a PDF. Progress updates while the job runs.
        </p>
      </div>

      <form onSubmit={(e) => void handleGenerate(e)} className="space-y-3">
        <label htmlFor="from-job-url" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Job link
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="from-job-url"
            type="url"
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            placeholder="https://boards.greenhouse.io/… or Lever / Ashby careers URL"
            className={`${inputClass} flex-1`}
            disabled={running}
            autoComplete="off"
          />
          <Button type="submit" disabled={running || !jobUrl.trim()} className="shrink-0 sm:px-6">
            {running ? "Generating…" : "Generate"}
          </Button>
          {running ? (
            <button
              type="button"
              onClick={stopRun}
              className="shrink-0 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.05]"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      {error ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {!englishTeamGateOpen && (running || job) ? (
        <ResumeFromJobProgress
          message={job?.message || (running ? "Working…" : "")}
          progressPercent={progressPercent}
          steps={steps}
          jobTitle={job?.jobTitle || result?.jobTitle}
          companyName={job?.companyName || result?.companyName}
          warning={job?.warning || result?.warning}
          downloadUrl={pdfDownloadUrl}
          downloadFileName={result?.pdfFileName || "resume.pdf"}
          onPreview={result?.pdfBase64 ? () => setPreviewOpen(true) : undefined}
        />
      ) : null}

      {result?.pdfBase64 && pdfDownloadUrl ? (
        <div
          ref={successRef}
          className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] px-5 py-4 shadow-sm"
        >
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            Generation complete
          </p>
          <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-300/90">
            {[result.jobTitle, result.companyName].filter(Boolean).join(" · ") || "Your resume PDF is ready."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={pdfDownloadUrl}
              download={result.pdfFileName || "resume.pdf"}
              className="inline-flex items-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
            >
              Download PDF — {result.pdfFileName || "resume.pdf"}
            </a>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="rounded-xl border border-emerald-500/30 bg-white/80 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-white dark:bg-white/10 dark:text-emerald-200"
            >
              Preview
            </button>
            {canOpenResumeChat ? (
              <button
                type="button"
                onClick={() => setResumeChatOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm font-semibold text-orange-700 transition-all hover:bg-orange-500/15 dark:text-orange-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Application Q&A
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <PdfPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={result?.pdfFileName || "Resume PDF"}
        subtitle={[result?.jobTitle, result?.companyName].filter(Boolean).join(" · ") || undefined}
        blob={pdfBlob}
        fileName={result?.pdfFileName || "resume.pdf"}
        onDownload={handleDownloadPdf}
      />

      <ResumeChatDialog
        open={resumeChatOpen}
        onClose={() => setResumeChatOpen(false)}
        content={chatContent}
        profile={chatProfile}
        jobTitle={jobTitle}
        companyName={companyName}
        jobDescription={jobDescription}
        generationKey={generationKey}
      />

      <EnglishTeamRequiredDialog
        open={englishTeamGateOpen}
        message={englishTeamGateMessage}
        jobTitle={job?.jobTitle || result?.jobTitle || ""}
        companyName={job?.companyName || result?.companyName || ""}
        jobDescription={jobDescription || job?.url || jobUrl}
        continuing={englishTeamContinuing || running}
        onJobCheck={() => {
          setEnglishTeamGateOpen(false);
          setEnglishTeamGateMessage("");
          void runJobCheck();
        }}
        onContinueCreating={() => {
          setEnglishTeamContinuing(true);
          void handleGenerate(undefined, { skipEnglishTeamGate: true });
        }}
        onClose={() => {
          setEnglishTeamGateOpen(false);
          setEnglishTeamGateMessage("");
          setEnglishTeamContinuing(false);
        }}
      />

      <JobCheckBoard
        open={jobCheckOpen}
        loading={jobChecking}
        error={jobCheckError}
        output={jobCheckOutput}
        jobTitle={job?.jobTitle || result?.jobTitle || ""}
        companyName={job?.companyName || result?.companyName || ""}
        onClose={() => {
          jobCheckAbortRef.current?.abort();
          jobCheckAbortRef.current = null;
          setJobCheckOpen(false);
          setJobChecking(false);
        }}
        onRetry={() => void runJobCheck()}
      />
    </div>
  );
}
