import { createHash } from "crypto";
import type { ResumeGenerateRequest } from "@/lib/resume-generate-prep";
import { fingerprintTemplateBase64 } from "@/lib/template-fingerprint";

export function buildResumeDedupeKey(body: ResumeGenerateRequest): string {
  const payload = JSON.stringify({
    templateName: body.templateName?.trim() ?? "",
    templateFingerprint: fingerprintTemplateBase64(body.templateBase64),
    jobTitle: body.jobTitle?.trim() ?? "",
    companyName: body.companyName?.trim() ?? "",
    jobDescription: body.jobDescription?.trim() ?? "",
    customPrompt: body.customPrompt?.trim() ?? "",
    regenerate: Boolean(body.atsFeedback && body.previousContent),
    previousTitle: body.previousContent?.title?.trim() ?? "",
    atsScore: body.atsFeedback?.overall ?? null,
    ruleKeepScore: body.ruleKeepFeedback?.overall ?? null,
  });

  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}
