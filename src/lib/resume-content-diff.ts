import type {
  AtsScoreResult,
  GeneratedResumeContent,
  ResumeUnifiedScoreResult,
} from "@/lib/resume-types";

export type ResumeFieldChange = {
  id: string;
  label: string;
  before: string;
  after: string;
};

export type FeedbackResolution = {
  overallBefore: number;
  overallAfter: number;
  solvedKeywords: string[];
  stillMissingKeywords: string[];
  improvedCategories: Array<{
    category: string;
    before: number;
    after: number;
    maxScore: number;
  }>;
  newlyPassedRules: string[];
  stillFailingRules: string[];
};

function normalizeCompareText(text: string): string {
  return text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function textsDiffer(before: string, after: string): boolean {
  return normalizeCompareText(before) !== normalizeCompareText(after);
}

function pushChange(
  changes: ResumeFieldChange[],
  id: string,
  label: string,
  before: string,
  after: string
): void {
  if (!textsDiffer(before, after)) return;
  changes.push({
    id,
    label,
    before: before.trim(),
    after: after.trim(),
  });
}

export function computeResumeContentDiff(
  before: GeneratedResumeContent,
  after: GeneratedResumeContent
): ResumeFieldChange[] {
  const changes: ResumeFieldChange[] = [];

  pushChange(changes, "title", "Resume title", before.title, after.title);
  pushChange(changes, "summary", "Summary", before.summary, after.summary);
  pushChange(changes, "skills", "Skillsets", before.skills, after.skills);

  const expCount = Math.max(before.experiences.length, after.experiences.length);
  for (let i = 0; i < expCount; i += 1) {
    const prev = before.experiences[i];
    const next = after.experiences[i];
    if (!prev || !next) continue;

    const prefix = `${prev.company || `Job ${i + 1}`}`;
    pushChange(changes, `exp-${i}-role`, `${prefix} — role`, prev.role, next.role);

    const bulletCount = Math.max(prev.bullets.length, next.bullets.length);
    for (let b = 0; b < bulletCount; b += 1) {
      pushChange(
        changes,
        `exp-${i}-bullet-${b}`,
        `${prefix} — bullet ${b + 1}`,
        prev.bullets[b] ?? "",
        next.bullets[b] ?? ""
      );
    }

    const projectCount = Math.max(prev.projects?.length ?? 0, next.projects?.length ?? 0);
    for (let p = 0; p < projectCount; p += 1) {
      const prevProject = prev.projects?.[p];
      const nextProject = next.projects?.[p];
      if (!prevProject || !nextProject) continue;

      const projectLabel = prevProject.name || `Project ${p + 1}`;
      const fields = [
        ["businessChallenge", "Business Challenge"],
        ["assignedResponsibility", "Assigned Responsibility"],
        ["action", "Action"],
        ["result", "Result"],
      ] as const;

      for (const [key, fieldLabel] of fields) {
        pushChange(
          changes,
          `exp-${i}-proj-${p}-${key}`,
          `${prefix} · ${projectLabel} — ${fieldLabel}`,
          prevProject[key],
          nextProject[key]
        );
      }
    }
  }

  return changes;
}

export function computeFeedbackResolution(
  before: ResumeUnifiedScoreResult,
  after: ResumeUnifiedScoreResult
): FeedbackResolution {
  const solvedKeywords = before.ats.missingKeywords.filter(
    (keyword) => !after.ats.missingKeywords.some((k) => k.toLowerCase() === keyword.toLowerCase())
  );

  const stillMissingKeywords = after.ats.missingKeywords.filter(
    (keyword) => !before.ats.missingKeywords.some((k) => k.toLowerCase() === keyword.toLowerCase())
  );

  const improvedCategories = after.ats.breakdown
    .map((item) => {
      const prev = before.ats.breakdown.find((b) => b.category === item.category);
      if (!prev || item.score <= prev.score) return null;
      return {
        category: item.category,
        before: prev.score,
        after: item.score,
        maxScore: item.maxScore,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const newlyPassedRules = after.ruleKeep.rules
    .filter((rule) => rule.passed)
    .filter((rule) => {
      const prev = before.ruleKeep.rules.find((r) => r.id === rule.id || r.rule === rule.rule);
      return prev && !prev.passed;
    })
    .map((rule) => rule.rule);

  const stillFailingRules = after.ruleKeep.rules.filter((rule) => !rule.passed).map((rule) => rule.rule);

  return {
    overallBefore: before.overall,
    overallAfter: after.overall,
    solvedKeywords,
    stillMissingKeywords,
    improvedCategories,
    newlyPassedRules,
    stillFailingRules,
  };
}

export function summarizeAtsCategoryGains(before: AtsScoreResult, after: AtsScoreResult): string[] {
  return after.breakdown
    .map((item) => {
      const prev = before.breakdown.find((b) => b.category === item.category);
      if (!prev || item.score <= prev.score) return null;
      return `${item.category}: ${prev.score}→${item.score}/${item.maxScore}`;
    })
    .filter((line): line is string => Boolean(line));
}
