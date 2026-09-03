"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
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

const PdfPreviewModal = dynamic(() => import("@/components/ui/PdfPreviewModal"), { ssr: false });

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
  const [jobUrl, setJobUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<ResumeFromJobJob | null>(null);
  const [result, setResult] = useState<ResumeFromJobResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);
  const downloadUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
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
            warning: resolved.warning || prev.warning,
          }
        : prev
    );
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

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (running) return;

    const url = jobUrl.trim();
    if (!url) {
      setError("Paste a job link first.");
      return;
    }

    abortRef.current?.abort();
    clearPollTimer();
    const controller = new AbortController();
    abortRef.current = controller;

    setError("");
    setResult(null);
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
      const started = await startResumeFromJob(url, controller.signal);
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

      {(running || job) && (
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
      )}

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
    </div>
  );
}
