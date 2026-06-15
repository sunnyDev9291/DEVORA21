import type { AtsPassGate, AtsScoreBreakdown, AtsScoreResult, GeneratedResumeContent } from "@/lib/resume-types";
import { keywordPresentInText, normalizeForMatch, type JobKeywords } from "@/lib/resume-ats-keywords";

export const ATS_PASS_THRESHOLD = 97;

export type StrictAtsComputation = {
  breakdown: AtsScoreBreakdown[];
  overall: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  gates: AtsPassGate[];
  mustHaveCoverage: number;
  niceToHaveCoverage: number;
};

const ACTION_VERBS =
  /^(?:engineered|developed|built|designed|implemented|led|managed|delivered|optimized|migrated|architected|automated|deployed|created|improved|reduced|increased|scaled|integrated|refactored|established|streamlined|collaborated|mentored|hardened|standardized|rebuilt|port|wired|hooked|overhauled|tuned|secured|served|provisioned|constructed|replaced|extracted|containerized|introduced|instrumented|enhanced|modernized|stabilized|crafted|maintained|participated|coordinated|executed|launched|owned|spearheaded|drove|achieved|accelerated|cut|lowered|raised|boosted|generated|saved|eliminated|consolidated|unified|powered|offloaded|set up|configured|monitored|debugged|resolved|fixed|tested|validated|documented|researched|analyzed|evaluated|defined|planned|scheduled|trained|supported|facilitated|transformed|upgraded|revamped|restructured|simplified|centralized|decentralized|distributed|parallelized|cached|indexed|profiled|benchmarked|load[- ]tested)\b/i;

const FIRST_PERSON = /\b(I|me|my|mine|we|our|ours)\b/i;
const METRIC_PATTERN = /\d+\s*%|\d+[kKmM]\+?|\$\d|(?:by|to|from)\s+\d+/;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function pct(n: number, d: number): number {
  if (d <= 0) return 1;
  return n / d;
}

function resumePlainText(content: GeneratedResumeContent): string {
  return [
    content.title,
    content.summary,
    content.skills,
    ...content.experiences.flatMap((e) => [e.role, e.company, ...e.bullets]),
  ].join("\n");
}

function allBullets(content: GeneratedResumeContent): string[] {
  return content.experiences.flatMap((e) => e.bullets);
}

function scoreMustHaveKeywords(
  keywords: JobKeywords,
  resumeText: string
): { score: number; matched: string[]; missing: string[]; coverage: number; notes: string } {
  const max = 30;
  const list = keywords.mustHave;
  if (list.length === 0) {
    return { score: max, matched: [], missing: [], coverage: 1, notes: "No must-have keywords extracted from JD." };
  }

  const matched = list.filter((k) => keywordPresentInText(k, resumeText));
  const missing = list.filter((k) => !keywordPresentInText(k, resumeText));
  const coverage = pct(matched.length, list.length);

  let score = coverage * max;
  if (coverage < 0.95) score = Math.min(score, 28);
  if (coverage < 0.85) score = Math.min(score, 24);
  if (coverage < 0.7) score = Math.min(score, 18);
  if (coverage < 0.5) score = Math.min(score, 10);

  return {
    score: clamp(score, 0, max),
    matched,
    missing,
    coverage,
    notes: `${matched.length}/${list.length} must-have keywords (${Math.round(coverage * 100)}%).`,
  };
}

function scoreNiceToHaveKeywords(
  keywords: JobKeywords,
  resumeText: string
): { score: number; matched: string[]; coverage: number; notes: string } {
  const max = 10;
  const list = keywords.niceToHave;
  if (list.length === 0) {
    return { score: max, matched: [], coverage: 1, notes: "No nice-to-have keywords in JD." };
  }

  const matched = list.filter((k) => keywordPresentInText(k, resumeText));
  const coverage = pct(matched.length, list.length);
  let score = coverage * max;
  if (coverage < 0.5) score = Math.min(score, 4);

  return {
    score: clamp(score, 0, max),
    matched,
    coverage,
    notes: `${matched.length}/${list.length} nice-to-have keywords (${Math.round(coverage * 100)}%).`,
  };
}

function scoreTitleAlignment(
  targetTitle: string,
  resumeTitle: string,
  roleKeywords: string[]
): { score: number; notes: string } {
  const max = 15;
  if (!resumeTitle.trim()) return { score: 0, notes: "Resume title is empty." };

  const target = normalizeForMatch(targetTitle || roleKeywords.join(" "));
  const resume = normalizeForMatch(resumeTitle);
  const tokens = [...new Set([...roleKeywords, ...targetTitle.split(/[\s|,/]+/)])]
    .map((t) => normalizeForMatch(t))
    .filter((t) => t.length > 2);

  if (tokens.length === 0) return { score: 10, notes: "Title present; no target title to compare." };

  const matched = tokens.filter((t) => resume.includes(t));
  const ratio = pct(matched.length, tokens.length);

  const seniority = ["junior", "senior", "staff", "principal", "lead", "mid"];
  const targetSenior = seniority.find((s) => target.includes(s));
  const resumeSenior = seniority.find((s) => resume.includes(s));
  let penalty = 0;
  if (targetSenior && resumeSenior && targetSenior !== resumeSenior) penalty += 5;

  let score = ratio * max - penalty;
  if (ratio < 0.5) score = Math.min(score, 6);

  return {
    score: clamp(score, 0, max),
    notes: `${matched.length}/${tokens.length} role tokens aligned${penalty ? "; seniority mismatch" : ""}.`,
  };
}

function scoreSkillsLine(keywords: JobKeywords, skills: string): { score: number; notes: string } {
  const max = 15;
  const must = keywords.mustHave;
  if (must.length === 0) return { score: max, notes: "Skills line present." };

  const inSkills = must.filter((k) => keywordPresentInText(k, skills));
  const coverage = pct(inSkills.length, must.length);

  let score = coverage * max;
  if (coverage < 0.6) score = Math.min(score, 8);
  if (!skills.includes(",") && skills.split(/\s+/).length > 6) {
    score = Math.max(0, score - 2);
  }

  return {
    score: clamp(score, 0, max),
    notes: `${inSkills.length}/${must.length} must-have skills in skillsets line (${Math.round(coverage * 100)}%).`,
  };
}

function scoreExperienceEvidence(
  keywords: JobKeywords,
  content: GeneratedResumeContent
): { score: number; notes: string } {
  const max = 20;
  const bullets = allBullets(content);
  if (bullets.length === 0) return { score: 0, notes: "No experience bullets." };

  const must = keywords.mustHave;
  const bulletsWithMust = bullets.filter((b) => must.some((k) => keywordPresentInText(k, b)));
  const mustCoverage = must.length ? pct(bulletsWithMust.length, Math.max(bullets.length * 0.5, 1)) : 1;

  const withMetrics = bullets.filter((b) => METRIC_PATTERN.test(b));
  const metricRatio = pct(withMetrics.length, bullets.length);

  const respMatch = keywords.responsibilities.filter((r) => {
    const words = normalizeForMatch(r).split(" ").filter((w) => w.length > 4);
    return bullets.some((b) => words.filter((w) => normalizeForMatch(b).includes(w)).length >= 2);
  });
  const respRatio = keywords.responsibilities.length
    ? pct(respMatch.length, keywords.responsibilities.length)
    : 0.7;

  let score = mustCoverage * 10 + metricRatio * 6 + respRatio * 4;
  if (metricRatio < 0.3) score = Math.min(score, 12);
  if (mustCoverage < 0.4 && must.length > 0) score = Math.min(score, 10);

  return {
    score: clamp(score, 0, max),
    notes: `${Math.round(metricRatio * 100)}% bullets with metrics; ${bulletsWithMust.length} bullets with must-have tech.`,
  };
}

function scoreSummaryQuality(
  keywords: JobKeywords,
  summary: string
): { score: number; notes: string } {
  const max = 10;
  if (!summary.trim()) return { score: 0, notes: "Summary is empty." };

  let score = max;
  const words = summary.split(/\s+/).length;

  if (words < 25) score -= 3;
  if (words > 120) score -= 2;
  if (FIRST_PERSON.test(summary)) score -= 4;

  const mustHits = keywords.mustHave.filter((k) => keywordPresentInText(k, summary)).length;
  if (keywords.mustHave.length > 0 && mustHits === 0) score -= 3;
  if (mustHits >= 2) score = Math.min(max, score + 1);

  return {
    score: clamp(score, 0, max),
    notes: `${words} words${FIRST_PERSON.test(summary) ? "; first-person detected" : ""}; ${mustHits} must-have terms.`,
  };
}

function scoreFormatCompliance(content: GeneratedResumeContent): {
  score: number;
  notes: string;
  verbRatio: number;
  issues: string[];
} {
  const max = 10;
  const bullets = allBullets(content);
  const issues: string[] = [];

  if (bullets.length === 0) return { score: 0, notes: "No bullets.", verbRatio: 0, issues };

  const verbStarts = bullets.filter((b) => ACTION_VERBS.test(b.trim())).length;
  const verbRatio = pct(verbStarts, bullets.length);
  if (verbRatio < 0.8) issues.push(`${Math.round(verbRatio * 100)}% bullets start with action verbs (need 80%+)`);

  const emDash = bullets.filter((b) => /—/.test(b)).length;
  if (emDash > 0) issues.push(`${emDash} bullet(s) contain em-dash (—)`);

  const firstPersonBullets = bullets.filter((b) => FIRST_PERSON.test(b)).length;
  if (firstPersonBullets > 0) issues.push(`${firstPersonBullets} bullet(s) use first-person pronouns`);

  const bracketStyle = bullets.filter((b) => /^\[[^\]]+\]/.test(b.trim())).length;
  if (bracketStyle > 0) issues.push(`${bracketStyle} bullet(s) use bracket-prefix style`);

  let score = max;
  if (verbRatio < 0.8) score -= (0.8 - verbRatio) * 10;
  if (verbRatio < 0.6) score -= 2;
  score -= emDash * 1.5;
  score -= firstPersonBullets * 2;
  score -= bracketStyle * 2;

  return {
    score: clamp(score, 0, max),
    notes: issues.length ? issues.join("; ") : "Bullets follow ATS format rules.",
    verbRatio,
    issues,
  };
}

export function computeStrictAtsScore(
  content: GeneratedResumeContent,
  jobTitle: string,
  keywords: JobKeywords
): StrictAtsComputation {
  const resumeText = resumePlainText(content);

  const must = scoreMustHaveKeywords(keywords, resumeText);
  const nice = scoreNiceToHaveKeywords(keywords, resumeText);
  const title = scoreTitleAlignment(jobTitle, content.title, keywords.roleKeywords);
  const skills = scoreSkillsLine(keywords, content.skills);
  const experience = scoreExperienceEvidence(keywords, content);
  const summary = scoreSummaryQuality(keywords, content.summary);
  const format = scoreFormatCompliance(content);

  const breakdown: AtsScoreBreakdown[] = [
    { category: "Must-have keywords", score: must.score, maxScore: 30, notes: must.notes },
    { category: "Nice-to-have keywords", score: nice.score, maxScore: 10, notes: nice.notes },
    { category: "Title alignment", score: title.score, maxScore: 15, notes: title.notes },
    { category: "Skills line coverage", score: skills.score, maxScore: 15, notes: skills.notes },
    { category: "Experience evidence", score: experience.score, maxScore: 20, notes: experience.notes },
    { category: "Summary quality", score: summary.score, maxScore: 10, notes: summary.notes },
    { category: "ATS format compliance", score: format.score, maxScore: 10, notes: format.notes },
  ];

  const overall = breakdown.reduce((s, b) => s + b.score, 0);
  const matchedKeywords = unique([...must.matched, ...nice.matched]);
  const missingKeywords = must.missing.slice(0, 12);

  const gates: AtsPassGate[] = [
    {
      name: `Overall score ≥ ${ATS_PASS_THRESHOLD}`,
      passed: overall >= ATS_PASS_THRESHOLD,
      detail: `Score: ${overall}/100`,
    },
    {
      name: "Must-have keyword coverage ≥ 95%",
      passed: must.coverage >= 0.95 || keywords.mustHave.length === 0,
      detail: `${Math.round(must.coverage * 100)}% (${must.matched.length}/${keywords.mustHave.length || "—"})`,
    },
    {
      name: "Title alignment ≥ 12/15",
      passed: title.score >= 12,
      detail: `${title.score}/15`,
    },
    {
      name: "Skills line ≥ 10/15",
      passed: skills.score >= 10,
      detail: `${skills.score}/15`,
    },
    {
      name: "Experience evidence ≥ 14/20",
      passed: experience.score >= 14,
      detail: `${experience.score}/20`,
    },
    {
      name: "80%+ bullets start with action verbs",
      passed: format.verbRatio >= 0.8,
      detail: `${Math.round(format.verbRatio * 100)}%`,
    },
    {
      name: "No critical format violations",
      passed: format.issues.filter((i) => i.includes("first-person") || i.includes("em-dash")).length === 0,
      detail: format.issues.length ? format.issues.join("; ") : "Clean",
    },
  ];

  return {
    breakdown,
    overall,
    matchedKeywords,
    missingKeywords,
    gates,
    mustHaveCoverage: must.coverage,
    niceToHaveCoverage: nice.coverage,
  };
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((i) => i.trim()).filter(Boolean))];
}

export function buildStrictRecommendations(
  computation: StrictAtsComputation,
  keywords: JobKeywords,
  content: GeneratedResumeContent
): string[] {
  const recs: string[] = [];

  if (computation.mustHaveCoverage < 0.95 && keywords.mustHave.length > 0) {
    const top = computation.missingKeywords.slice(0, 4);
    recs.push(`Add must-have keywords to skills and bullets: ${top.join(", ")}.`);
  }

  const titleBreakdown = computation.breakdown.find((b) => b.category === "Title alignment");
  if (titleBreakdown && titleBreakdown.score < 12) {
    recs.push(`Align resume title with target role — include seniority and core stack from the job title.`);
  }

  const skillsBreakdown = computation.breakdown.find((b) => b.category === "Skills line coverage");
  if (skillsBreakdown && skillsBreakdown.score < 10) {
    recs.push(`Front-load the skillsets line with must-have JD technologies (bold priority terms first).`);
  }

  const expBreakdown = computation.breakdown.find((b) => b.category === "Experience evidence");
  if (expBreakdown && expBreakdown.score < 14) {
    recs.push(`Add quantified metrics (%, time saved, scale) and weave must-have tech into more bullets.`);
  }

  const summaryBreakdown = computation.breakdown.find((b) => b.category === "Summary quality");
  if (summaryBreakdown && summaryBreakdown.score < 8) {
    recs.push(`Expand summary to 2–4 sentences with must-have keywords; remove first-person pronouns.`);
  }

  const formatBreakdown = computation.breakdown.find((b) => b.category === "ATS format compliance");
  if (formatBreakdown && formatBreakdown.score < 8) {
    recs.push(`Rewrite bullets to start with strong past-tense verbs; remove em-dashes and bracket prefixes.`);
  }

  const bullets = allBullets(content);
  if (bullets.filter((b) => METRIC_PATTERN.test(b)).length / Math.max(bullets.length, 1) < 0.4) {
    recs.push(`Increase metric density — aim for measurable outcomes in at least 40% of bullets.`);
  }

  if (computation.niceToHaveCoverage < 0.5 && keywords.niceToHave.length > 0) {
    recs.push(`Incorporate nice-to-have skills: ${keywords.niceToHave.slice(0, 3).join(", ")}.`);
  }

  return recs.slice(0, 6);
}

export function buildStrictSummary(
  computation: StrictAtsComputation,
  passed: boolean
): string {
  if (passed) {
    return `Strict ATS evaluation passed (${computation.overall}/100) — must-have coverage, title, skills, and format meet the ${ATS_PASS_THRESHOLD}% bar.`;
  }
  const failed = computation.gates.filter((g) => !g.passed).map((g) => g.name);
  return `Score ${computation.overall}/100 — failed ${failed.length} gate(s): ${failed.slice(0, 2).join("; ")}${failed.length > 2 ? "…" : ""}.`;
}

export function toAtsScoreResult(
  computation: StrictAtsComputation,
  recommendations: string[]
): AtsScoreResult {
  const passed = computation.gates.every((g) => g.passed);
  return {
    overall: computation.overall,
    passed,
    breakdown: computation.breakdown,
    matchedKeywords: computation.matchedKeywords.slice(0, 15),
    missingKeywords: computation.missingKeywords.slice(0, 12),
    recommendations,
    summary: buildStrictSummary(computation, passed),
    gates: computation.gates,
    mustHaveCoverage: Math.round(computation.mustHaveCoverage * 100),
    algorithm: "strict-v2",
  };
}
