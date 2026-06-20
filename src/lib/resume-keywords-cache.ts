import { createHash } from "crypto";
import { completeDeepSeek } from "@/lib/deepseek-stream";
import {
  buildKeywordExtractUserPrompt,
  extractHeuristicKeywords,
  KEYWORD_EXTRACT_PROMPT,
  parseKeywordExtractJson,
  type JobKeywords,
} from "@/lib/resume-ats-keywords";
import { getCachedValue, setCachedValue } from "@/lib/server-cache";

export function buildJobKeywordsCacheKey(
  jobTitle: string,
  companyName: string,
  jobDescription: string
): string {
  const payload = JSON.stringify({
    jobTitle: jobTitle.trim(),
    companyName: companyName.trim(),
    jobDescription: jobDescription.trim(),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

async function extractJobKeywordsWithAi(
  jobTitle: string,
  jobDescription: string,
  companyName: string
): Promise<JobKeywords> {
  const heuristic = extractHeuristicKeywords(jobTitle, jobDescription, companyName);

  if (!jobDescription.trim()) {
    return heuristic;
  }

  try {
    const raw = await completeDeepSeek(
      [
        { role: "system", content: KEYWORD_EXTRACT_PROMPT },
        {
          role: "user",
          content: buildKeywordExtractUserPrompt(jobTitle, jobDescription, companyName),
        },
      ],
      2048,
      { jsonObject: true }
    );

    const ai = parseKeywordExtractJson(raw);
    if (!ai) return heuristic;

    return {
      mustHave: ai.mustHave.length > 0 ? ai.mustHave : heuristic.mustHave,
      niceToHave: ai.niceToHave.length > 0 ? ai.niceToHave : heuristic.niceToHave,
      roleKeywords: ai.roleKeywords.length > 0 ? ai.roleKeywords : heuristic.roleKeywords,
      responsibilities:
        ai.responsibilities.length > 0 ? ai.responsibilities : heuristic.responsibilities,
    };
  } catch {
    return heuristic;
  }
}

export async function getCachedJobKeywords(
  jobTitle: string,
  companyName: string,
  jobDescription: string,
  options?: { cacheKey?: string }
): Promise<{ keywords: JobKeywords; cacheKey: string }> {
  const cacheKey =
    options?.cacheKey ??
    buildJobKeywordsCacheKey(jobTitle, companyName, jobDescription);

  const blobKey = `jd-keywords:${cacheKey}`;
  const cached = await getCachedValue<JobKeywords>(blobKey);
  if (cached) {
    return { keywords: cached, cacheKey };
  }

  const keywords = await extractJobKeywordsWithAi(jobTitle, jobDescription, companyName);
  await setCachedValue(blobKey, keywords);
  return { keywords, cacheKey };
}
