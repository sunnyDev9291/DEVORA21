import { completeDeepSeek } from "@/lib/deepseek-stream";
import { parseJobCheckJson } from "@/lib/job-check-parse";
import {
  buildJobCheckUserPrompt,
  JOB_CHECK_SYSTEM_PROMPT,
} from "@/lib/job-check-prompt";
import type { JobCheckRequest, JobCheckResult } from "@/lib/job-check-types";

export async function analyzeJobCheck(input: JobCheckRequest): Promise<JobCheckResult> {
  const jobTitle = input.jobTitle?.trim() ?? "";
  const companyName = input.companyName.trim();
  const jobDescription = input.jobDescription?.trim() ?? "";

  if (!companyName) {
    throw new Error("Company name is required for Job Check.");
  }

  const raw = await completeDeepSeek(
    [
      { role: "system", content: JOB_CHECK_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildJobCheckUserPrompt(jobTitle, companyName, jobDescription),
      },
    ],
    2048,
    { jsonObject: true, userId: input.userId }
  );

  const parsed = parseJobCheckJson(raw, { jobTitle, companyName });
  if (!parsed) {
    throw new Error("Could not parse Job Check response from AI.");
  }

  if (!jobDescription) {
    parsed.warnings = [
      "Job description was empty — client, salary, and work-mode detection may be less accurate.",
      ...parsed.warnings,
    ].slice(0, 3);
  }

  return parsed;
}
