import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { ApiError } from "@/lib/auth-api";
import {
  RESUME_BUILDER_ACCESS_MESSAGE,
  isResumeBuilderAccessDenied,
  resumeBuilderAccessDeniedMessage,
} from "@/lib/resume-access";

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
  return {
    id: typeof row.id === "string" ? row.id : undefined,
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

function parseJob(data: Record<string, unknown>, fallbackJobId = ""): ResumeFromJobJob {
  const jobId =
    (typeof data.jobId === "string" && data.jobId.trim()) ||
    (typeof data.id === "string" && data.id.trim()) ||
    fallbackJobId;

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
    result: parseResult(data.result),
  };
}

/** POST /resume/from-job — expect 202 + jobId. */
export async function startResumeFromJob(
  url: string,
  signal?: AbortSignal
): Promise<ResumeFromJobJob> {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new ApiError("Paste a job link first.", 400);
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
        body: JSON.stringify({ url: trimmed }),
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
