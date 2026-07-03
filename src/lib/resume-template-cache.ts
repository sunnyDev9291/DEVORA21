import { createHash } from "crypto";
import type { GeneratedResumeContent, ResumeTemplateLayout } from "@/lib/resume-types";
import { getCachedValue, setCachedValue } from "@/lib/server-cache";
import { parseTemplateContentSamples } from "@/lib/resume-docx";
import {
  resolveTemplateFromDocx,
  type TemplateParseResult,
} from "@/lib/resume-docx-ai-parse";

function templateCacheKey(templateName: string, buffer: Buffer): string {
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  return `template-parse:${templateName.trim().toLowerCase()}:${hash}`;
}

export async function getCachedTemplateParse(
  templateName: string,
  buffer: Buffer
): Promise<TemplateParseResult> {
  const key = templateCacheKey(templateName, buffer);
  const cached = await getCachedValue<TemplateParseResult>(key);
  if (cached?.experiences?.length) {
    return {
      ...cached,
      skillsSample: cached.skillsSample ?? parseTemplateContentSamples(buffer).skills,
    };
  }

  const parsed = await resolveTemplateFromDocx(buffer);
  await setCachedValue(key, parsed);
  return parsed;
}
export async function getCachedTemplateLayout(
  templateName: string,
  buffer: Buffer
): Promise<ResumeTemplateLayout> {
  const { layout } = await getCachedTemplateParse(templateName, buffer);
  return layout;
}

export async function getCachedTemplateExperiences(
  templateName: string,
  buffer: Buffer
): Promise<GeneratedResumeContent["experiences"]> {
  const { experiences } = await getCachedTemplateParse(templateName, buffer);
  return experiences;
}
