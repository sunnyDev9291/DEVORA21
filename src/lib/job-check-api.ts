import { ApiError } from "@/lib/auth-api";
import type { JobCheckRequest, JobCheckResult } from "@/lib/job-check-types";

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

function errorMessage(data: Record<string, unknown>, fallback: string): string {
  if (typeof data.error === "string" && data.error.trim()) return data.error.trim();
  if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
  return fallback;
}

export async function checkJob(input: JobCheckRequest): Promise<JobCheckResult> {
  const companyName = input.companyName?.trim() ?? "";
  if (!companyName) {
    throw new ApiError("Company name is required for Job Check.", 400);
  }

  const res = await fetch("/api/job/check", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      jobTitle: input.jobTitle?.trim() ?? "",
      companyName,
      jobDescription: input.jobDescription?.trim() ?? "",
      userId: input.userId,
    }),
    cache: "no-store",
  });

  const data = await readJson(res);
  if (!res.ok) {
    throw new ApiError(errorMessage(data, "Job Check failed."), res.status);
  }

  return data as JobCheckResult;
}
