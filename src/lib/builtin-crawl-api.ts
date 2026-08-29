import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { ApiError } from "@/lib/auth-api";
import {
  isBuiltInListingUrl,
  stripBuiltInPageParam,
  type BuiltInCrawlJob,
  type BuiltInCrawlResult,
} from "@/lib/builtin-crawl-types";
import {
  RESUME_BUILDER_ACCESS_MESSAGE,
  isResumeBuilderAccessDenied,
  resumeBuilderAccessDeniedMessage,
} from "@/lib/resume-access";
import type { ApiError as ApiErrorBody } from "@/types/auth";

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

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseJob(raw: unknown, index: number): BuiltInCrawlJob {
  if (!raw || typeof raw !== "object") {
    return { jobId: String(index), companyName: "", jobTitle: "", jobUrl: "" };
  }
  const obj = raw as Record<string, unknown>;
  return {
    jobId: asString(obj.jobId) || String(index),
    companyName: asString(obj.companyName),
    jobTitle: asString(obj.jobTitle),
    jobUrl: asString(obj.jobUrl),
  };
}

function parseResult(data: Record<string, unknown>, fallbackUrl: string): BuiltInCrawlResult {
  const jobsRaw = Array.isArray(data.jobs) ? data.jobs : [];
  const jobs = jobsRaw.map((item, index) => parseJob(item, index));

  return {
    sourceUrl: asString(data.sourceUrl, fallbackUrl),
    platform: "builtin",
    pagesScraped: asNumber(data.pagesScraped),
    totalCount: asNumber(data.totalCount, jobs.length),
    jobs,
  };
}

function validateListingUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new ApiError("Paste a Built In jobs listing URL first.", 400);
  }
  if (!isBuiltInListingUrl(trimmed)) {
    throw new ApiError("URL must be a valid https://builtin.com/jobs/… listing.", 400);
  }
  return stripBuiltInPageParam(trimmed);
}

/** POST /jobs/crawl/builtin — backend crawls all pagination pages via Zyte. */
export async function crawlBuiltInJobs(
  url: string,
  signal?: AbortSignal
): Promise<BuiltInCrawlResult> {
  const listingUrl = validateListingUrl(url);

  let res: Response;
  try {
    res = await apiAuthFetch(`${API_BASE_URL}/jobs/crawl/builtin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ url: listingUrl }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new ApiError("Built In crawl timed out. Try again or use a narrower listing URL.", 504);
    }
    throw new Error("Could not reach the Built In crawl service. Check your connection and try again.");
  }

  const data = await readJson(res);

  if (!res.ok) {
    const body = asApiErrorBody(data);
    const message = errorMessage(data, `Built In crawl failed (${res.status}).`);

    if (res.status === 401) {
      throw new ApiError(errorMessage(data, "Please sign in to crawl Built In jobs."), 401, body);
    }
    if (res.status === 403) {
      const err = new ApiError(message, 403, body);
      if (isResumeBuilderAccessDenied(err)) {
        throw new ApiError(RESUME_BUILDER_ACCESS_MESSAGE, 403, body);
      }
      throw new ApiError(resumeBuilderAccessDeniedMessage(err), 403, body);
    }
    if (res.status === 422) {
      throw new ApiError(
        errorMessage(data, "No jobs found. The listing may be empty or Built In changed their layout."),
        422,
        body
      );
    }
    if (res.status === 504) {
      throw new ApiError(
        errorMessage(data, "Built In crawl timed out. Try again with a narrower listing URL."),
        504,
        body
      );
    }
    throw new ApiError(message, res.status, body);
  }

  return parseResult(data, listingUrl);
}
