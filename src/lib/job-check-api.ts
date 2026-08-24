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

  let res: Response;
  try {
    res = await fetch("/api/job/check", {
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
  } catch {
    throw new ApiError("Could not reach Job Check. Check your connection and try again.", 0);
  }

  const data = await readJson(res);
  if (!res.ok) {
    const detail = errorMessage(data, "");
    const suffix = detail ? `: ${detail}` : res.status === 404
      ? " (404 — route not found; deploy may be pending)"
      : ` (HTTP ${res.status})`;
    throw new ApiError(`Job Check failed${suffix}`, res.status);
  }

  return data as JobCheckResult;
}
