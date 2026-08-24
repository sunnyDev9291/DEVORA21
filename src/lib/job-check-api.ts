import { ApiError } from "@/lib/auth-api";
import { analyzeJobCheckClient } from "@/lib/job-check-client";
import type { JobCheckRequest, JobCheckResult } from "@/lib/job-check-types";

export async function checkJob(input: JobCheckRequest): Promise<JobCheckResult> {
  const companyName = input.companyName?.trim() ?? "";
  if (!companyName) {
    throw new ApiError("Company name is required for Job Check.", 400);
  }

  try {
    return await analyzeJobCheckClient(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Job Check failed.";
    if (message.toLowerCase().includes("504") || message.toLowerCase().includes("timeout")) {
      throw new ApiError(
        "Job Check timed out. Try again with a shorter job description, or connect a dv21_ API key.",
        504
      );
    }
    throw new ApiError(message, 0);
  }
}
