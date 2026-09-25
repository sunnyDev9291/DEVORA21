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
  type ResumeFromJobJob,
  type ResumeFromJobResult,
} from "@/lib/resume-from-job-api";
import { iterateJobCheckStream } from "@/lib/job-check-stream";
import { useAuth } from "@/context/AuthContext";
import { loadStoredProfile, resolveUserNames } from "@/lib/user-profile";
import { scrapeJobFromUrl } from "@/lib/job-scrape-api";
import { resolveResumeChatContent } from "@/lib/resume-chat-prompt";
import type { GeneratedResumeContent } from "@/lib/resume-types";
import type { ResumeWorkspaceFabActions } from "@/components/ui/ResumeWorkspaceFabs";
import { resolveWritingPrompt } from "@/lib/writing-prompt";

const PdfPreviewModal = dynamic(() => import("@/components/ui/PdfPreviewModal"), { ssr: false });
const ResumeChatDialog = dynamic(() => import("@/components/ui/ResumeChatDialog"));
const ResumeDownloadChooser = dynamic(() => import("@/components/ui/ResumeDownloadChooser"), {
  ssr: false,
});

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

interface ResumeFromJobPanelProps {
  onFabActionsChange?: (actions: ResumeWorkspaceFabActions | null) => void;
}

export default function ResumeFromJobPanel({ onFabActionsChange }: ResumeFromJobPanelProps) {
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
  const [downloadChooserOpen, setDownloadChooserOpen] = useState(false);
  const [downloadFeedback, setDownloadFeedback] = useState<{
    tone: "ok" | "err" | "pending";
    text: string;
  } | null>(null);
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

  function handleClear() {
    stopRun();
    jobCheckAbortRef.current?.abort();
    jobCheckAbortRef.current = null;
    setJobUrl("");
    setError("");
    setJob(null);
    setResult(null);
    setChatContent(null);
    setJobDescription("");
    setResumeChatOpen(false);
    setPreviewOpen(false);
    setJobCheckOpen(false);
    setJobChecking(false);
    setJobCheckOutput("");
    setJobCheckError("");
    setGenerationKey((k) => k + 1);
  }

  const hasClearableContent =
    !!jobUrl.trim() || !!job || !!result || !!chatContent || !!error;

  useEffect(() => {
    if (!onFabActionsChange) return;

    const hasResult = Boolean(result?.pdfBase64);
    const ready = hasResult || canOpenResumeChat;
    if (!ready) {
      onFabActionsChange(null);
      return;
    }

    onFabActionsChange({
      showClear: true,
      clearDisabled: running,
      onClear: handleClear,
      showChat: true,
      chatDisabled: running || !canOpenResumeChat,
      onOpenChat: () => setResumeChatOpen(true),
    });
  }, [
    onFabActionsChange,
    result?.pdfBase64,
    canOpenResumeChat,
    running,
  ]); // eslint-disable-line react-hooks/exhaustive-deps -- handleClear reads latest state

  useEffect(() => {
    return () => onFabActionsChange?.(null);
  }, [onFabActionsChange]);

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

  async function handleGenerate(e?: React.FormEvent) {
    e?.preventDefault();
    if (running) return;

    const url = jobUrl.trim();
    if (!url) {
      setError("Paste a job link first.");
      return;
    }

    let freshPrompt = "";
    try {
      const resolved = await resolveWritingPrompt(user?.id);
      freshPrompt = resolved.content.trim();
      if (!freshPrompt) {
        throw new Error(
          "Profile prompt not found. Upload a prompt in your Devora21 profile before generating a resume."
        );
      }
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
        skipEnglishTeamGate: true,
        customPrompt: freshPrompt || undefined,
      });
      setJob(started);

      if (isResumeFromJobTerminal(started.status)) {
        if (started.status === "done") {
          await finishWithResult(started, controller.signal);
          return;
        }
        throw new Error(started.error || started.message || "Resume generation failed.");
      }

      await pollUntilDone(started.jobId, startedAt, controller.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
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
      clearPollTimer();
    }
  }

  function handleDownloadPdf() {
    const id = result?.id?.trim();
    if (id) {
      setDownloadFeedback(null);
      setDownloadChooserOpen(true);
      return;
    }
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
          Backend scrapes the posting, fills your template, and returns a PDF. Progress updates while
          the job runs.
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
              Stop
            </button>
          ) : null}
        </div>
      </form>

      {error ? (
        <p className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {job ? (
        <div ref={successRef}>
          <ResumeFromJobProgress
            message={job.message || ""}
            progressPercent={progressPercent}
            steps={steps}
            jobTitle={jobTitle}
            companyName={companyName}
            warning={result?.warning || job.warning}
            downloadUrl={pdfDownloadUrl}
            downloadFileName={result?.pdfFileName || "resume.pdf"}
            onPreview={pdfBlob ? () => setPreviewOpen(true) : undefined}
          />
        </div>
      ) : null}

      {result?.pdfBase64 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleDownloadPdf}>
              Download
            </Button>
            <Button type="button" variant="secondary" onClick={() => setPreviewOpen(true)}>
              Preview PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void runJobCheck()}
              disabled={jobChecking || !(companyName || "").trim()}
            >
              {jobChecking ? "Job Check…" : "Job Check"}
            </Button>
            {hasClearableContent ? (
              <Button type="button" variant="secondary" onClick={handleClear} disabled={running}>
                Clear
              </Button>
            ) : null}
          </div>
          {downloadFeedback ? (
            <p
              className={`text-sm font-medium ${
                downloadFeedback.tone === "ok"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : downloadFeedback.tone === "pending"
                    ? "text-orange-700 dark:text-orange-300"
                    : "text-red-700 dark:text-red-300"
              }`}
              role="status"
            >
              {downloadFeedback.text}
            </p>
          ) : null}
        </div>
      ) : null}

      <PdfPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={jobTitle || "Resume PDF"}
        subtitle={companyName || undefined}
        fileName={result?.pdfFileName}
        blob={pdfBlob}
        waitingForPdf={running && !pdfBlob}
        onDownload={handleDownloadPdf}
      />

      <ResumeDownloadChooser
        open={downloadChooserOpen}
        archiveId={result?.id}
        onClose={() => setDownloadChooserOpen(false)}
        defaultIncludePdf
        defaultIncludeDocx
        onFeedback={setDownloadFeedback}
      />

      <JobCheckBoard
        open={jobCheckOpen}
        onClose={() => {
          jobCheckAbortRef.current?.abort();
          setJobCheckOpen(false);
        }}
        companyName={companyName}
        jobTitle={jobTitle}
        output={jobCheckOutput}
        error={jobCheckError}
        loading={jobChecking}
        onRetry={() => void runJobCheck()}
      />

      <ResumeChatDialog
        open={resumeChatOpen}
        onClose={() => setResumeChatOpen(false)}
        content={chatContent}
        jobTitle={jobTitle}
        companyName={companyName}
        jobDescription={jobDescription}
        profile={chatProfile}
        generationKey={generationKey}
      />
    </div>
  );
}
