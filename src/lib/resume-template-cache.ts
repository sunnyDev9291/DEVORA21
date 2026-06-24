import type { GeneratedResumeContent } from "@/lib/resume-types";
import { getCachedValue, setCachedValue } from "@/lib/server-cache";
import { resolveExperiencesFromDocx } from "@/lib/resume-docx-ai-parse";

function templateCacheKey(templateName: string): string {
  return `template-exp:${templateName.trim().toLowerCase()}`;
}

export async function getCachedTemplateExperiences(
  templateName: string,
  buffer: Buffer
): Promise<GeneratedResumeContent["experiences"]> {
  const key = templateCacheKey(templateName);
  const cached = await getCachedValue<GeneratedResumeContent["experiences"]>(key);
  if (cached?.length) {
    return cached;
  }

  const experiences = await resolveExperiencesFromDocx(buffer);
  await setCachedValue(key, experiences);
  return experiences;
}
