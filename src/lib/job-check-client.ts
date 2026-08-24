import { getUserApiKey } from "@/lib/user-api-key";
import { iterateBrowserAiStream } from "@/lib/browser-ai-stream";
import { parseJobCheckJson } from "@/lib/job-check-parse";
import {
  buildJobCheckUserPrompt,
  JOB_CHECK_SYSTEM_PROMPT,
} from "@/lib/job-check-prompt";
import type { JobCheckRequest, JobCheckResult } from "@/lib/job-check-types";

async function resolveStreamAuthToken(): Promise<string> {
  const userKey = getUserApiKey();
  if (userKey) return userKey;

  const res = await fetch("/api/job/check/auth", {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const data = (await res.json().catch(() => ({}))) as {
    streamAuthToken?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      data.error?.trim() ||
        "Sign in or connect a dv21_ API key in settings to run Job Check."
    );
  }

  const token = data.streamAuthToken?.trim() ?? "";
  if (!token) {
    throw new Error(
      "AI is not configured for Job Check. Connect a dv21_ API key or try again after signing in."
    );
  }
  return token;
}

/**
 * Run Job Check in the browser → api.devora21.com (streaming).
 * Avoids Netlify /api/job/check gateway timeouts (504).
 */
export async function analyzeJobCheckClient(input: JobCheckRequest): Promise<JobCheckResult> {
  const jobTitle = input.jobTitle?.trim() ?? "";
  const companyName = input.companyName.trim();
  const jobDescription = input.jobDescription?.trim() ?? "";

  if (!companyName) {
    throw new Error("Company name is required for Job Check.");
  }

  const authToken = await resolveStreamAuthToken();
  const messages = [
    { role: "system" as const, content: JOB_CHECK_SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: buildJobCheckUserPrompt(jobTitle, companyName, jobDescription),
    },
  ];

  let full = "";
  for await (const delta of iterateBrowserAiStream(messages, 2048, {
    authToken,
    userId: input.userId,
    jsonObject: true,
  })) {
    full += delta.content ?? "";
  }

  const raw = full.trim();
  if (!raw) {
    throw new Error("Empty response from AI.");
  }

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
