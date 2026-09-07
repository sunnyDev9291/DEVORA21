import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { ApiError } from "@/lib/auth-api";
import {
  RESUME_BUILDER_ACCESS_MESSAGE,
  isResumeBuilderAccessDenied,
  resumeBuilderAccessDeniedMessage,
} from "@/lib/resume-access";
import {
  EnglishTeamRequiredError,
  parseEnglishTeamRequired,
} from "@/lib/english-team-gate";

export type ResumeFromJobStatus =
  | "queued"
  | "scraping"
  | "generating"
  | "filling"
  | "rendering"
  | "done"
  | "error";

export type ResumeFromJobStepState = "pending" | "active" | "done" | "error";

export type ResumeFromJobStep = {
  key: string;
  label: string;
  state: ResumeFromJobStepState;
};

export type ResumeFromJobResult = {
  id?: string;
  jobTitle: string;
  companyName: string;
  resumeName: string;
  pdfFileName: string;
  pdfBase64: string;
  warning?: string;
};

export type ResumeFromJobJob = {
  jobId: string;
  status: ResumeFromJobStatus;
  message?: string;
  step?: number;
  totalSteps?: number;
  progressPercent?: number;
  steps?: ResumeFromJobStep[];
  url?: string;
  jobTitle?: string;
  companyName?: string;
  warning?: string;
  error?: string;
  /** Present when generation was blocked by English-team gate. */
  code?: string;
  answer?: string;
  workWithEnglishTeam?: boolean;
  result?: ResumeFromJobResult;
};

const DEFAULT_STEPS: ResumeFromJobStep[] = [
  { key: "queued", label: "Queued", state: "pending" },
  { key: "scraping", label: "Scrape job", state: "pending" },
  { key: "generating", label: "Generate resume", state: "pending" },
  { key: "filling", label: "Fill DOCX", state: "pending" },
  { key: "rendering", label: "Render PDF", state: "pending" },
  { key: "done", label: "Complete", state: "pending" },
];

export const RESUME_FROM_JOB_POLL_MS = 1500;
export const RESUME_FROM_JOB_TIMEOUT_MS = 12 * 60 * 1000;

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

function errorMessage(data: Record<string, unknown>, fallback: string): string {
  if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
  if (typeof data.error === "string" && data.error.trim()) return data.error.trim();
  return fallback;
}

function throwAuthAware(res: Response, data: Record<string, unknown>): never {
  const gated = parseEnglishTeamRequired(data, res.status);
  if (gated) throw gated;

  const message = errorMessage(data, `Request failed (${res.status}).`);
  if (res.status === 401) {
    throw new ApiError("Authentication required. Sign in or connect a dv21_ API key.", 401, {
      message,
    });
  }
  if (res.status === 403) {
    const err = new ApiError(message, 403, { message });
    if (isResumeBuilderAccessDenied(err)) {
      throw new ApiError(RESUME_BUILDER_ACCESS_MESSAGE, 403, { message });
    }
    throw new ApiError(resumeBuilderAccessDeniedMessage(err), 403, { message });
  }
  throw new ApiError(message, res.status, { message });
}

function asStatus(value: unknown): ResumeFromJobStatus {
  const s = String(value ?? "");
  if (
    s === "queued" ||
    s === "scraping" ||
    s === "generating" ||
    s === "filling" ||
    s === "rendering" ||
    s === "done" ||
    s === "error"
  ) {
    return s;
  }
  return "queued";
}

function asStepState(value: unknown): ResumeFromJobStepState {
  const s = String(value ?? "");
  if (s === "pending" || s === "active" || s === "done" || s === "error") return s;
  return "pending";
}

function parseSteps(raw: unknown): ResumeFromJobStep[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const steps = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const key = String(row.key ?? "").trim();
      const label = String(row.label ?? key).trim();
      if (!key) return null;
      return { key, label, state: asStepState(row.state) };
    })
    .filter((s): s is ResumeFromJobStep => Boolean(s));
  return steps.length ? steps : undefined;
}

function parseResult(raw: unknown): ResumeFromJobResult | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  const pdfBase64 = typeof row.pdfBase64 === "string" ? row.pdfBase64.trim() : "";
  if (!pdfBase64) return undefined;
  return buildResult(row, pdfBase64);
}

function parseResultMeta(raw: unknown): Omit<ResumeFromJobResult, "pdfBase64"> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  const id =
    (typeof row.id === "string" && row.id.trim()) ||
    (typeof row.archiveId === "string" && row.archiveId.trim()) ||
    undefined;
  const jobTitle = typeof row.jobTitle === "string" ? row.jobTitle : "";
  const companyName = typeof row.companyName === "string" ? row.companyName : "";
  const resumeName = typeof row.resumeName === "string" ? row.resumeName : "";
  const pdfFileName =
    typeof row.pdfFileName === "string" && row.pdfFileName.trim()
      ? row.pdfFileName.trim()
      : "resume.pdf";
  const warning = typeof row.warning === "string" && row.warning.trim() ? row.warning.trim() : undefined;

  if (!id && !jobTitle && !companyName && !resumeName) return undefined;
  return { id, jobTitle, companyName, resumeName, pdfFileName, warning };
}

function buildResult(row: Record<string, unknown>, pdfBase64: string): ResumeFromJobResult {
  const id =
    (typeof row.id === "string" && row.id.trim()) ||
    (typeof row.archiveId === "string" && row.archiveId.trim()) ||
    undefined;
  return {
    id,
    jobTitle: typeof row.jobTitle === "string" ? row.jobTitle : "",
    companyName: typeof row.companyName === "string" ? row.companyName : "",
    resumeName: typeof row.resumeName === "string" ? row.resumeName : "",
    pdfFileName:
      typeof row.pdfFileName === "string" && row.pdfFileName.trim()
        ? row.pdfFileName.trim()
        : "resume.pdf",
    pdfBase64,
    warning: typeof row.warning === "string" && row.warning.trim() ? row.warning.trim() : undefined,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Could not read PDF response."));
    reader.readAsDataURL(blob);
  });
}

function parsePartialResult(raw: unknown): ResumeFromJobResult | undefined {
  const withPdf = parseResult(raw);
  if (withPdf) return withPdf;

  const meta = parseResultMeta(raw);
  if (!meta?.id) return undefined;

  return { ...meta, pdfBase64: "" };
}

function parseJob(data: Record<string, unknown>, fallbackJobId = ""): ResumeFromJobJob {
  const jobId =
    (typeof data.jobId === "string" && data.jobId.trim()) ||
    (typeof data.id === "string" && data.id.trim() && !parsePartialResult(data)
      ? data.id.trim()
      : "") ||
    fallbackJobId;

  const result = parsePartialResult(data.result) ?? parsePartialResult(data);

  return {
    jobId,
    status: asStatus(data.status),
    message: typeof data.message === "string" ? data.message : undefined,
    step: typeof data.step === "number" ? data.step : undefined,
    totalSteps: typeof data.totalSteps === "number" ? data.totalSteps : undefined,
    progressPercent: typeof data.progressPercent === "number" ? data.progressPercent : undefined,
    steps: parseSteps(data.steps),
    url: typeof data.url === "string" ? data.url : undefined,
    jobTitle: typeof data.jobTitle === "string" ? data.jobTitle : undefined,
    companyName: typeof data.companyName === "string" ? data.companyName : undefined,
    warning: typeof data.warning === "string" && data.warning.trim() ? data.warning.trim() : undefined,
    error: typeof data.error === "string" ? data.error : undefined,
    code: typeof data.code === "string" ? data.code : undefined,
    answer: typeof data.answer === "string" ? data.answer : undefined,
    workWithEnglishTeam:
      typeof data.workWithEnglishTeam === "boolean" ? data.workWithEnglishTeam : undefined,
    result,
  };
}

/** Throw when a from-job job payload is blocked by the English-team gate. */
export function throwIfEnglishTeamRequiredJob(job: ResumeFromJobJob): void {
  const gated = parseEnglishTeamRequired(
    {
      code: job.code,
      answer: job.answer,
      workWithEnglishTeam: job.workWithEnglishTeam,
      message: job.message || job.error,
      error: job.error || job.message,
    },
    422
  );
  if (gated) throw gated;

  // Fallback: some backends only put the code on nested error objects.
  if (job.status === "error" && job.code === "ENGLISH_TEAM_REQUIRED") {
    throw new EnglishTeamRequiredError(job.message || job.error);
  }
}

/** Resolve PDF bytes when job is done — uses inline base64 or archive download fallback. */
export async function resolveResumeFromJobResult(
  job: ResumeFromJobJob,
  signal?: AbortSignal
): Promise<ResumeFromJobResult> {
  if (job.result?.pdfBase64) return job.result;

  const meta =
    parseResultMeta(job.result) ??
    parseResultMeta({
      id: job.result?.id,
      jobTitle: job.result?.jobTitle ?? job.jobTitle,
      companyName: job.result?.companyName ?? job.companyName,
      resumeName: job.result?.resumeName,
      pdfFileName: job.result?.pdfFileName,
      warning: job.result?.warning ?? job.warning,
    });

  const archiveId = meta?.id;
  if (!archiveId) {
    throw new Error("Job completed but no PDF was returned.");
  }

  const { fetchSavedResumeFile } = await import("@/lib/saved-resumes-api");
  const { blob, fileName } = await fetchSavedResumeFile(archiveId, "pdf", meta?.pdfFileName);

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const pdfBase64 = await blobToBase64(blob);
  if (!pdfBase64) {
    throw new Error("Job completed but the PDF file was empty.");
  }

  return {
    id: archiveId,
    jobTitle: meta?.jobTitle ?? job.jobTitle ?? "",
    companyName: meta?.companyName ?? job.companyName ?? "",
    resumeName: meta?.resumeName ?? "",
    pdfFileName: fileName,
    pdfBase64,
    warning: meta?.warning ?? job.warning,
  };
}

/** POST /resume/from-job — expect 202 + jobId. */
export async function startResumeFromJob(
  url: string,
  signal?: AbortSignal,
  options?: { skipEnglishTeamGate?: boolean }
): Promise<ResumeFromJobJob> {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new ApiError("Paste a job link first.", 400);
  }

  const payload: Record<string, unknown> = { url: trimmed };
  if (options?.skipEnglishTeamGate) {
    payload.skipEnglishTeamGate = true;
    payload.skip_english_team_gate = true;
  }

  let res: Response;
  try {
    res = await apiAuthFetch(
      `${API_BASE_URL}/resume/from-job`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal,
      },
      "auto"
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new Error("Could not reach the resume service. Check your connection and try again.");
  }

  const data = await readJson(res);

  if (res.status !== 202 && !res.ok) {
    throwAuthAware(res, data);
  }

  const job = parseJob(data);
  if (!job.jobId) {
    throw new ApiError("Resume job started but no jobId was returned.", 502, {
      message: "Missing jobId",
    });
  }

  return {
    ...job,
    status: job.status || "queued",
    message: job.message || "Queued — starting resume pipeline…",
    progressPercent: job.progressPercent ?? 0,
    steps: job.steps ?? DEFAULT_STEPS.map((s, i) => (i === 0 ? { ...s, state: "active" } : s)),
  };
}

/** GET /resume/from-job/:jobId */
export async function getResumeFromJobStatus(
  jobId: string,
  signal?: AbortSignal
): Promise<ResumeFromJobJob> {
  const id = jobId.trim();
  if (!id) {
    throw new ApiError("Missing job id.", 400);
  }

  let res: Response;
  try {
    res = await apiAuthFetch(
      `${API_BASE_URL}/resume/from-job/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal,
      },
      "auto"
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new Error("Could not poll resume job status. Check your connection and try again.");
  }

  const data = await readJson(res);
  if (!res.ok) {
    throwAuthAware(res, data);
  }

  return parseJob(data, id);
}

export function isResumeFromJobTerminal(status: ResumeFromJobStatus): boolean {
  return status === "done" || status === "error";
}

export function mergeResumeFromJobSteps(
  incoming: ResumeFromJobStep[] | undefined,
  status: ResumeFromJobStatus
): ResumeFromJobStep[] {
  if (incoming?.length) return incoming;

  const order = DEFAULT_STEPS.map((s) => s.key);
  const activeIdx = order.indexOf(status === "error" ? "done" : status);

  return DEFAULT_STEPS.map((step, index) => {
    if (status === "error" && index === Math.max(activeIdx, 0)) {
      return { ...step, state: "error" };
    }
    if (status === "done") {
      return { ...step, state: "done" };
    }
    if (index < activeIdx) return { ...step, state: "done" };
    if (index === activeIdx) return { ...step, state: "active" };
    return { ...step, state: "pending" };
  });
}
