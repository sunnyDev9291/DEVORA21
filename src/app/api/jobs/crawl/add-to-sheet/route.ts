import { appendJobsToCountrySheet } from "@/lib/google-sheets";
import { isJobSheetCountry } from "@/lib/job-sheet-countries";
import { ALL_JOB_CRAWL_PLATFORMS, JOB_CRAWL_PLATFORM_LABEL, type JobCrawlPlatform } from "@/lib/builtin-crawl-types";

export const runtime = "nodejs";

type IncomingJob = {
  platform?: unknown;
  jobUrl?: unknown;
};

function isPlatform(value: string): value is JobCrawlPlatform {
  return (ALL_JOB_CRAWL_PLATFORMS as readonly string[]).includes(value);
}

export async function POST(req: Request) {
  let body: { country?: unknown; jobs?: IncomingJob[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const countryRaw = typeof body.country === "string" ? body.country.trim() : "";
  if (!isJobSheetCountry(countryRaw)) {
    return Response.json(
      {
        error:
          "country must be one of: Brazil, Argentina, Colombia, Dominican Republic, Other.",
      },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.jobs) || body.jobs.length === 0) {
    return Response.json({ error: "Select at least one job to add." }, { status: 400 });
  }

  if (body.jobs.length > 200) {
    return Response.json({ error: "You can add at most 200 jobs at once." }, { status: 400 });
  }

  const jobs = body.jobs
    .map((job) => {
      const platformRaw = typeof job.platform === "string" ? job.platform.trim() : "";
      const jobUrl = typeof job.jobUrl === "string" ? job.jobUrl.trim() : "";
      const platformLabel = isPlatform(platformRaw)
        ? JOB_CRAWL_PLATFORM_LABEL[platformRaw]
        : platformRaw || "Unknown";
      return { platform: platformLabel, jobUrl };
    })
    .filter((job) => job.jobUrl.length > 0);

  if (jobs.length === 0) {
    return Response.json({ error: "Selected jobs are missing URLs." }, { status: 400 });
  }

  try {
    const result = await appendJobsToCountrySheet(countryRaw, jobs);
    return Response.json({
      ok: true,
      ...result,
      message:
        result.added === 0
          ? `No new rows added to ${result.country} (all ${result.skippedDuplicates} already on the sheet).`
          : `Added ${result.added} job${result.added === 1 ? "" : "s"} to ${result.country}${
              result.skippedDuplicates > 0
                ? ` (${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? "" : "s"} skipped)`
                : ""
            }.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add jobs to the sheet.";
    const status = /not configured|not set/i.test(message) ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
