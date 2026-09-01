import { API_BASE_URL } from "@/lib/api-base-url";

import { apiAuthFetch } from "@/lib/api-auth";

import { ApiError } from "@/lib/auth-api";

import {

  detectJobCrawlPlatform,

  isBuiltInListingUrl,

  isHiringCafeListingUrl,

  isWorkableListingUrl,

  stripListingPageParam,

  type JobCrawlJob,

  type JobCrawlPlatform,

  type JobCrawlResult,

} from "@/lib/builtin-crawl-types";

import {

  RESUME_BUILDER_ACCESS_MESSAGE,

  isResumeBuilderAccessDenied,

  resumeBuilderAccessDeniedMessage,

} from "@/lib/resume-access";

import type { ApiError as ApiErrorBody } from "@/types/auth";



/** @deprecated Use JobCrawlJob */

export type BuiltInCrawlJob = JobCrawlJob;



/** @deprecated Use JobCrawlResult */

export type BuiltInCrawlResult = JobCrawlResult;



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



function parseJob(raw: unknown, index: number): JobCrawlJob {

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



function parsePlatform(value: unknown, fallback: JobCrawlPlatform): JobCrawlPlatform {

  return value === "hiringcafe" || value === "builtin" || value === "workable" ? value : fallback;

}



function parseResult(

  data: Record<string, unknown>,

  fallbackUrl: string,

  fallbackPlatform: JobCrawlPlatform

): JobCrawlResult {

  const jobsRaw = Array.isArray(data.jobs) ? data.jobs : [];

  const jobs = jobsRaw.map((item, index) => parseJob(item, index));

  const pagesScraped = asNumber(data.pagesScraped, 0);



  return {

    sourceUrl: asString(data.sourceUrl, fallbackUrl),

    platform: parsePlatform(data.platform, fallbackPlatform),

    ...(pagesScraped > 0 ? { pagesScraped } : {}),

    totalCount: asNumber(data.totalCount, jobs.length),

    jobs,

  };

}



type CrawlConfig = {

  platform: JobCrawlPlatform;

  path: "/jobs/crawl/builtin" | "/jobs/crawl/hiringcafe" | "/jobs/crawl/workable";

  label: string;

  validate: (url: string) => boolean;

  invalidMessage: string;

  emptyMessage: string;

};



const CRAWL_CONFIG: Record<JobCrawlPlatform, CrawlConfig> = {

  builtin: {

    platform: "builtin",

    path: "/jobs/crawl/builtin",

    label: "Built In",

    validate: isBuiltInListingUrl,

    invalidMessage: "URL must be a valid https://builtin.com/jobs/… listing.",

    emptyMessage: "No jobs found. The listing may be empty or Built In changed their layout.",

  },

  hiringcafe: {

    platform: "hiringcafe",

    path: "/jobs/crawl/hiringcafe",

    label: "HiringCafe",

    validate: isHiringCafeListingUrl,

    invalidMessage: "URL must be a valid https://hiringcafe.com/… listing (page 0, with searchState).",

    emptyMessage: "No jobs found. The listing may be empty or HiringCafe changed their layout.",

  },

  workable: {

    platform: "workable",

    path: "/jobs/crawl/workable",

    label: "Workable",

    validate: isWorkableListingUrl,

    invalidMessage: "URL must be a valid https://jobs.workable.com/search?… listing URL.",

    emptyMessage: "No jobs found for this search. The listing may be empty or Workable changed their layout.",

  },

};



function validateListingUrl(url: string, platform: JobCrawlPlatform): string {

  const trimmed = url.trim();

  const config = CRAWL_CONFIG[platform];



  if (!trimmed) {

    throw new ApiError(`Paste a ${config.label} listing URL first.`, 400);

  }

  if (!config.validate(trimmed)) {

    throw new ApiError(config.invalidMessage, 400);

  }

  return stripListingPageParam(trimmed);

}



async function postJobCrawl(

  platform: JobCrawlPlatform,

  url: string,

  signal?: AbortSignal

): Promise<JobCrawlResult> {

  const config = CRAWL_CONFIG[platform];

  const listingUrl = validateListingUrl(url, platform);



  let res: Response;

  try {

    res = await apiAuthFetch(`${API_BASE_URL}${config.path}`, {

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

      throw new ApiError(

        `${config.label} crawl timed out. Try again or use a narrower listing URL.`,

        504

      );

    }

    throw new Error(

      `Could not reach the ${config.label} crawl service. Check your connection and try again.`

    );

  }



  const data = await readJson(res);



  if (!res.ok) {

    const body = asApiErrorBody(data);

    const message = errorMessage(data, `${config.label} crawl failed (${res.status}).`);



    if (res.status === 401) {

      throw new ApiError(errorMessage(data, `Please sign in to crawl ${config.label} jobs.`), 401, body);

    }

    if (res.status === 403) {

      const err = new ApiError(message, 403, body);

      if (isResumeBuilderAccessDenied(err)) {

        throw new ApiError(RESUME_BUILDER_ACCESS_MESSAGE, 403, body);

      }

      throw new ApiError(resumeBuilderAccessDeniedMessage(err), 403, body);

    }

    if (res.status === 422) {

      throw new ApiError(errorMessage(data, config.emptyMessage), 422, body);

    }

    if (res.status === 503) {

      throw new ApiError(

        errorMessage(data, "Job crawl service is unavailable. Contact support."),

        503,

        body

      );

    }

    if (res.status === 504) {

      throw new ApiError(

        errorMessage(data, `${config.label} crawl timed out. Try again with a narrower listing URL.`),

        504,

        body

      );

    }

    throw new ApiError(message, res.status, body);

  }



  return parseResult(data, listingUrl, platform);

}



/** POST /jobs/crawl/builtin — backend crawls all pagination pages via Zyte. */

export async function crawlBuiltInJobs(url: string, signal?: AbortSignal): Promise<JobCrawlResult> {

  return postJobCrawl("builtin", url, signal);

}



/** POST /jobs/crawl/hiringcafe — backend crawls all pagination pages via Zyte. */

export async function crawlHiringCafeJobs(url: string, signal?: AbortSignal): Promise<JobCrawlResult> {

  return postJobCrawl("hiringcafe", url, signal);

}



/** POST /jobs/crawl/workable — single-page Workable search via Zyte. */

export async function crawlWorkableJobs(url: string, signal?: AbortSignal): Promise<JobCrawlResult> {

  return postJobCrawl("workable", url, signal);

}



/** POST /jobs/discover/hiringcafe — page 0 only. */

export async function discoverHiringCafeJobs(url: string, signal?: AbortSignal): Promise<JobCrawlResult> {

  const listingUrl = validateListingUrl(url, "hiringcafe");



  let res: Response;

  try {

    res = await apiAuthFetch(`${API_BASE_URL}/jobs/discover/hiringcafe`, {

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

      throw new ApiError("HiringCafe discover timed out. Try again or use a narrower listing URL.", 504);

    }

    throw new Error("Could not reach the HiringCafe discover service. Check your connection and try again.");

  }



  const data = await readJson(res);

  if (!res.ok) {

    const body = asApiErrorBody(data);

    throw new ApiError(errorMessage(data, `HiringCafe discover failed (${res.status}).`), res.status, body);

  }



  return parseResult(data, listingUrl, "hiringcafe");

}



/** Route to Built In, HiringCafe, or Workable crawl based on listing URL host. */

export async function crawlJobs(url: string, signal?: AbortSignal): Promise<JobCrawlResult> {

  const platform = detectJobCrawlPlatform(url);

  if (platform === "hiringcafe") return crawlHiringCafeJobs(url, signal);

  if (platform === "builtin") return crawlBuiltInJobs(url, signal);

  if (platform === "workable") return crawlWorkableJobs(url, signal);

  throw new ApiError("URL must be a builtin.com, hiringcafe.com, or jobs.workable.com listing.", 400);

}


