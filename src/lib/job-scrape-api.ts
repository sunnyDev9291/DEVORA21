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

export type JobScrapeResult = {
  url: string;
  source: JobScrapeSource | string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  location: string;
  confidence: JobScrapeConfidence | string;
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

function pickString(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
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

  const jobTitle = pickString(data, "jobTitle", "title", "job_title");
  const companyName = pickString(data, "companyName", "company", "company_name");
  const jobDescription = pickString(
    data,
    "jobDescription",
    "description",
    "job_description"
  );
  const location = pickString(data, "location", "jobLocation", "job_location");

  if (!jobTitle) {
    throw new ApiError(
      "Could not extract a job title from that link. Check the URL or enter the title manually.",
      422,
      { message: "Missing jobTitle in scrape response." }
    );
  }

  return {
    url: pickString(data, "url") || trimmed,
    source: pickString(data, "source") || "generic",
    jobTitle,
    companyName,
    jobDescription,
    location,
    confidence: pickString(data, "confidence") || "medium",
    warning: pickString(data, "warning") || undefined,
  };
}
