import { createHash } from "crypto";
import type { ResumeGenerateRequest } from "@/lib/resume-generate-prep";

export function buildResumeDedupeKey(body: ResumeGenerateRequest): string {
  const payload = JSON.stringify({
    templateName: body.templateName?.trim() ?? "",
    jobTitle: body.jobTitle?.trim() ?? "",
    companyName: body.companyName?.trim() ?? "",
    jobDescription: body.jobDescription?.trim() ?? "",
    customPrompt: body.customPrompt?.trim() ?? "",
    regenerate: Boolean(body.atsFeedback && body.previousContent),
    previousTitle: body.previousContent?.title?.trim() ?? "",
    atsScore: body.atsFeedback?.overall ?? null,
    toneScore: body.humanToneFeedback?.overall ?? null,
  });

  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}
