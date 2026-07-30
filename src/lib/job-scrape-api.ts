import { API_BASE_URL } from "@/lib/api-base-url";
import { ApiError } from "@/lib/auth-api";
import {
  RESUME_BUILDER_ACCESS_MESSAGE,
  isResumeBuilderAccessDenied,
  resumeBuilderAccessDeniedMessage,
} from "@/lib/resume-access";
import type { ApiError as ApiErrorBody } from "@/types/auth";

export type JobScrapeSource = "greenhouse" | "lever" | "ashby" | "generic";
export type JobScrapeConfidence = "high" | "medium" | "low";

/** Fixed success shape from POST /jobs/scrape (Zyte → DeepSeek normalized). */
export type JobScrapeResult = {
  url: string;
  source: JobScrapeSource;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  confidence: JobScrapeConfidence;
  warning?: string;
};

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

function errorMessage(data: Record<string, unknown>, fallback: string): string {
  if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
  if (typeof data.error === "string" && data.error.trim()) return data.error.trim();
  return fallback;
}

function asApiErrorBody(data: Record<string, unknown>): ApiErrorBody {
  return {
    message: errorMessage(data, "Request failed"),
  };
}

function asString(data: Record<string, unknown>, key: string, fallback = ""): string {
  const value = data[key];
  return typeof value === "string" ? value.trim() : fallback;
}

function asSource(value: string): JobScrapeSource {
  if (value === "greenhouse" || value === "lever" || value === "ashby" || value === "generic") {
    return value;
  }
  return "generic";
}

function asConfidence(value: string): JobScrapeConfidence {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "medium";
}

/** POST /jobs/scrape on api.devora21.com (session cookies). */
export async function scrapeJobFromUrl(url: string): Promise<JobScrapeResult> {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new ApiError("Paste a job link first.", 400);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/jobs/scrape`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ url: trimmed }),
    });
  } catch {
    throw new Error(
      "Could not reach the job scrape service. Paste the job description manually instead."
    );
  }

  const data = await readJson(res);

  if (!res.ok) {
    const body = asApiErrorBody(data);
    if (res.status === 401) {
      throw new ApiError(errorMessage(data, "Please sign in to fetch a job link."), 401, body);
    }
    if (res.status === 403) {
      const err = new ApiError(
        errorMessage(data, RESUME_BUILDER_ACCESS_MESSAGE),
        403,
        body
      );
      if (isResumeBuilderAccessDenied(err)) {
        throw new ApiError(RESUME_BUILDER_ACCESS_MESSAGE, 403, body);
      }
      throw new ApiError(resumeBuilderAccessDeniedMessage(err), 403, body);
    }
    if (res.status === 429) {
      throw new ApiError(
        errorMessage(data, "Too many job fetches. Please wait a minute and try again."),
        429,
        body
      );
    }
    if (res.status === 400) {
      throw new ApiError(
        errorMessage(
          data,
          "That URL is invalid or blocked. Try a Greenhouse, Lever, or Ashby posting."
        ),
        400,
        body
      );
    }
    throw new ApiError(
      errorMessage(data, `Could not fetch that job (${res.status}).`),
      res.status,
      body
    );
  }

  const warning = asString(data, "warning");

  // Soft failures stay HTTP 200 with empty strings + confidence/warning — never throw here.
  return {
    url: asString(data, "url", trimmed),
    source: asSource(asString(data, "source", "generic")),
    companyName: asString(data, "companyName"),
    jobTitle: asString(data, "jobTitle"),
    jobDescription: asString(data, "jobDescription"),
    confidence: asConfidence(asString(data, "confidence", "medium")),
    ...(warning ? { warning } : {}),
  };
}
