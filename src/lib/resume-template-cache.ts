import { createHash } from "crypto";
import type { GeneratedResumeContent, ResumeTemplateLayout } from "@/lib/resume-types";
import { getCachedValue, setCachedValue } from "@/lib/server-cache";
import {
  parseTemplateStructureSync,
  resolveTemplateFromDocx,
  type TemplateParseResult,
} from "@/lib/resume-docx-ai-parse";

function templateCacheKey(templateName: string, buffer: Buffer): string {
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  return `template-parse:${templateName.trim().toLowerCase()}:${hash}`;
}

function mergeFreshStructure(
  buffer: Buffer,
  base: Partial<TemplateParseResult> | null
): TemplateParseResult {
  const fresh = parseTemplateStructureSync(buffer);
  if (fresh.valid) {
    return {
      layout: fresh.layout,
      experiences: fresh.experiences,
      skillsSample: fresh.skillsSample,
    };
  }

  if (base?.experiences?.length) {
    return {
      layout: fresh.layout,
      experiences: base.experiences,
      skillsSample: fresh.skillsSample,
    };
  }

  return {
    layout: fresh.layout,
    experiences: fresh.experiences,
    skillsSample: fresh.skillsSample,
  };
}

export async function getCachedTemplateParse(
  templateName: string,
  buffer: Buffer
): Promise<TemplateParseResult> {
  const key = templateCacheKey(templateName, buffer);
  const cached = await getCachedValue<TemplateParseResult>(key);
  const fromStructure = mergeFreshStructure(buffer, cached);
  const structural = parseTemplateStructureSync(buffer);

  if (fromStructure.experiences.length > 0 && structural.valid) {
    await setCachedValue(key, fromStructure);
    return fromStructure;
  }

  if (cached?.experiences?.length) {
    return mergeFreshStructure(buffer, cached);
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
