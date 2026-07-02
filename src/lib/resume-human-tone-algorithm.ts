import type { GeneratedResumeContent, HumanToneScoreResult } from "@/lib/resume-types";
import { flattenContentExperienceText } from "@/lib/resume-experience-utils";

export const HUMAN_TONE_SCORE_MAX = 100;
/** Strong natural tone — separate from ATS pass threshold. */
export const HUMAN_TONE_PASS_THRESHOLD = 95;

const SCORE_MAX = {
  verbDiversity: 20,
  structureVariety: 15,
  humanContext: 15,
  naturalMetrics: 15,
  buzzwordControl: 15,
  summaryVoice: 10,
  formatAuthenticity: 10,
};

const ACTION_VERB =
  /^(?:engineered|developed|built|designed|implemented|led|managed|delivered|optimized|migrated|architected|automated|deployed|created|improved|reduced|increased|scaled|integrated|refactored|established|streamlined|collaborated|mentored|hardened|standardized|rebuilt|wired|overhauled|tuned|secured|provisioned|constructed|replaced|extracted|containerized|introduced|instrumented|enhanced|modernized|stabilized|crafted|maintained|participated|coordinated|executed|launched|owned|spearheaded|drove|achieved|accelerated|cut|lowered|raised|boosted|generated|saved|eliminated|consolidated|unified|powered|configured|monitored|debugged|resolved|fixed|tested|validated|documented|researched|analyzed|evaluated|defined|planned|scheduled|trained|supported|facilitated|transformed|upgraded|revamped|restructured|simplified|centralized|distributed|parallelized|cached|indexed|profiled|benchmarked)\b/i;

const FIRST_PERSON = /\b(I|me|my|mine|we|our|ours)\b/i;
const METRIC_PATTERN = /\d+\s*%|\d+[kKmM]\+?|\$\d|(?:by|to|from)\s+\d+/;

const HUMAN_CUE =
  /\b(coordinated|collaborated|partnered|aligned|cross[- ]functional|stakeholder|refactored after|production incident|trade[- ]off|balanced|paired with|worked with|hand[- ]off|incident|post[- ]mortem|on[- ]call|legacy|constraint|bottleneck|rollout|migration path|with (?:backend|frontend|qa|devops|design|product|security)|across teams)\b/i;

const AI_BUZZWORDS = [
  "leveraged",
  "spearheaded",
  "synerg",
  "cutting-edge",
  "cutting edge",
  "robust solution",
  "highly scalable",
  "results-driven",
  "results driven",
  "proven track record",
  "extensive experience",
  "utilized",
  "utilizing",
  "pivotal",
  "transformative",
  "dynamic environment",
  "thought leader",
  "best-in-class",
  "best in class",
  "world-class",
  "world class",
  "passionate about",
  "go-getter",
  "detail-oriented",
  "detail oriented",
];

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function pct(n: number, d: number): number {
  if (d <= 0) return 1;
  return n / d;
}

function allBullets(content: GeneratedResumeContent): string[] {
  return flattenContentExperienceText(content);
}

function bulletWordCounts(bullets: string[]): number[] {
  return bullets.map((b) => b.split(/\s+/).filter(Boolean).length);
}

function extractLeadingVerbs(bullets: string[]): string[] {
  return bullets
    .map((b) => {
      const m = b.trim().match(ACTION_VERB);
      return m ? m[0].toLowerCase() : "";
    })
    .filter(Boolean);
}

function repeatedPhraseRatio(bullets: string[]): number {
  if (bullets.length < 2) return 0;
  const phrases = new Map<string, number>();
  for (const bullet of bullets) {
    const words = bullet.toLowerCase().split(/\s+/).filter(Boolean);
    for (let i = 0; i <= words.length - 4; i += 1) {
      const phrase = words.slice(i, i + 4).join(" ");
      phrases.set(phrase, (phrases.get(phrase) ?? 0) + 1);
    }
  }
  let repeated = 0;
  for (const count of phrases.values()) {
    if (count > 1) repeated += count - 1;
  }
  return repeated / Math.max(bullets.length, 1);
}

function scoreVerbDiversity(bullets: string[]): { score: number; notes: string } {
  const max = SCORE_MAX.verbDiversity;
  if (bullets.length === 0) return { score: 0, notes: "No experience bullets." };

  const verbs = extractLeadingVerbs(bullets);
  const uniqueRatio = pct(new Set(verbs).size, Math.max(verbs.length, 1));
  const verbCounts = new Map<string, number>();
  for (const v of verbs) verbCounts.set(v, (verbCounts.get(v) ?? 0) + 1);
  const overused = [...verbCounts.values()].filter((c) => c >= 3).length;
  const phraseRep = repeatedPhraseRatio(bullets);

  let score = uniqueRatio * 12 + (1 - Math.min(phraseRep, 1)) * 8;
  if (uniqueRatio >= 0.85) score = Math.min(max, score + 2);
  if (overused > 0) score -= overused * 3;
  if (phraseRep > 0.35) score -= 4;

  return {
    score: clamp(score, 0, max),
    notes: `${Math.round(uniqueRatio * 100)}% unique action verbs${overused ? `; ${overused} overused` : ""}.`,
  };
}

function scoreStructureVariety(bullets: string[]): { score: number; notes: string } {
  const max = SCORE_MAX.structureVariety;
  if (bullets.length < 2) return { score: Math.round(max * 0.6), notes: "Too few bullets to assess variety." };

  const counts = bulletWordCounts(bullets);
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance =
    counts.reduce((sum, c) => sum + (c - avg) ** 2, 0) / counts.length;
  const stdDev = Math.sqrt(variance);
  const cv = avg > 0 ? stdDev / avg : 0;

  let score = Math.min(max, cv * 40 + 4);
  if (cv >= 0.12 && cv <= 0.28) score = Math.min(max, score + 2);
  if (cv < 0.06) score = Math.min(score, max - 6);
  if (cv > 0.45) score = Math.min(score, max - 2);

  const tooUniform = counts.filter((c) => Math.abs(c - avg) <= 2).length / counts.length;
  if (tooUniform > 0.85) score = Math.min(score, max - 5);

  return {
    score: clamp(score, 0, max),
    notes: `Bullet length spread σ=${stdDev.toFixed(1)} words (avg ${avg.toFixed(0)}).`,
  };
}

function scoreHumanContext(bullets: string[]): { score: number; notes: string } {
  const max = SCORE_MAX.humanContext;
  if (bullets.length === 0) return { score: 0, notes: "No bullets." };

  const withCue = bullets.filter((b) => HUMAN_CUE.test(b)).length;
  const ratio = pct(withCue, bullets.length);

  let score = ratio * max;
  if (ratio >= 0.25) score = Math.min(max, score + 2);
  if (ratio >= 0.4) score = Math.min(max, score + 1);
  if (ratio < 0.08) score = Math.min(score, max - 6);

  return {
    score: clamp(score, 0, max),
    notes: `${withCue}/${bullets.length} bullets show collaboration, context, or trade-offs.`,
  };
}

function scoreNaturalMetrics(bullets: string[]): { score: number; notes: string } {
  const max = SCORE_MAX.naturalMetrics;
  if (bullets.length === 0) return { score: 0, notes: "No bullets." };

  const withMetric = bullets.filter((b) => METRIC_PATTERN.test(b)).length;
  const ratio = pct(withMetric, bullets.length);
  const pctOnly = bullets.filter((b) => /\d+\s*%/.test(b) && !/\d+\s*(ms|sec|users|requests|locations|teams)/i.test(b)).length;

  let score = max;
  if (ratio < 0.2) score -= 5;
  if (ratio > 0.85) score -= 4;
  if (pctOnly / Math.max(withMetric, 1) > 0.75 && withMetric >= 4) score -= 3;
  if (ratio >= 0.3 && ratio <= 0.65) score = Math.min(max, score + 1);

  return {
    score: clamp(score, 0, max),
    notes: `${Math.round(ratio * 100)}% bullets with metrics — aim for varied, contextual numbers.`,
  };
}

function scoreBuzzwordControl(text: string): { score: number; notes: string; hits: string[] } {
  const max = SCORE_MAX.buzzwordControl;
  const lower = text.toLowerCase();
  const hits = AI_BUZZWORDS.filter((w) => lower.includes(w));
  const words = text.split(/\s+/).length;
  const density = hits.length / Math.max(words / 100, 1);

  let score = max;
  score -= hits.length * 2.5;
  score -= Math.max(0, density - 1) * 3;
  if (hits.length === 0) score = max;

  return {
    score: clamp(score, 0, max),
    notes: hits.length ? `${hits.length} AI-style buzzword(s) detected.` : "No common AI buzzword clutter.",
    hits,
  };
}

function scoreSummaryVoice(summary: string): { score: number; notes: string } {
  const max = SCORE_MAX.summaryVoice;
  if (!summary.trim()) return { score: 0, notes: "Summary is empty." };

  let score = max;
  const words = summary.split(/\s+/).length;
  if (FIRST_PERSON.test(summary)) score -= 4;
  if (words < 20) score -= 2;
  if (words > 140) score -= 2;
  if (/—/.test(summary)) score -= 2;
  if (/\b(leveraged|spearheaded|synerg|cutting-edge)\b/i.test(summary)) score -= 3;

  const sentences = summary.split(/[.!?]+/).filter(Boolean).length;
  if (sentences >= 2 && sentences <= 4) score = Math.min(max, score + 1);

  return {
    score: clamp(score, 0, max),
    notes: `${words} words, ${sentences} sentence(s)${FIRST_PERSON.test(summary) ? "; first-person" : ""}.`,
  };
}

function scoreFormatAuthenticity(bullets: string[]): { score: number; notes: string; issues: string[] } {
  const max = SCORE_MAX.formatAuthenticity;
  if (bullets.length === 0) return { score: 0, notes: "No bullets.", issues: [] };

  const issues: string[] = [];
  const emDash = bullets.filter((b) => /—/.test(b)).length;
  const brackets = bullets.filter((b) => /^\[[^\]]+\]/.test(b.trim())).length;
  const firstPerson = bullets.filter((b) => FIRST_PERSON.test(b)).length;

  if (emDash) issues.push(`${emDash} em-dash (—)`);
  if (brackets) issues.push(`${brackets} bracket-prefix labels`);
  if (firstPerson) issues.push(`${firstPerson} first-person pronouns`);

  let score = max;
  score -= emDash * 2;
  score -= brackets * 2.5;
  score -= firstPerson * 2;

  return {
    score: clamp(score, 0, max),
    notes: issues.length ? issues.join("; ") : "Clean, recruiter-friendly formatting.",
    issues,
  };
}

export function computeHumanToneScore(content: GeneratedResumeContent): HumanToneScoreResult {
  const bullets = allBullets(content);
  const fullText = [content.title, content.summary, content.skills, ...bullets].join("\n");

  const verb = scoreVerbDiversity(bullets);
  const structure = scoreStructureVariety(bullets);
  const context = scoreHumanContext(bullets);
  const metrics = scoreNaturalMetrics(bullets);
  const buzz = scoreBuzzwordControl(fullText);
  const summary = scoreSummaryVoice(content.summary);
  const format = scoreFormatAuthenticity(bullets);

  const breakdown = [
    { category: "Verb & phrase diversity", score: verb.score, maxScore: SCORE_MAX.verbDiversity, notes: verb.notes },
    { category: "Sentence structure variety", score: structure.score, maxScore: SCORE_MAX.structureVariety, notes: structure.notes },
    { category: "Collaboration & context", score: context.score, maxScore: SCORE_MAX.humanContext, notes: context.notes },
    { category: "Natural metrics", score: metrics.score, maxScore: SCORE_MAX.naturalMetrics, notes: metrics.notes },
    { category: "Buzzword control", score: buzz.score, maxScore: SCORE_MAX.buzzwordControl, notes: buzz.notes },
    { category: "Summary voice", score: summary.score, maxScore: SCORE_MAX.summaryVoice, notes: summary.notes },
    { category: "Format authenticity", score: format.score, maxScore: SCORE_MAX.formatAuthenticity, notes: format.notes },
  ];

  const overall = clamp(breakdown.reduce((s, b) => s + b.score, 0), 0, HUMAN_TONE_SCORE_MAX);
  const passed = overall >= HUMAN_TONE_PASS_THRESHOLD;

  const gates = [
    {
      name: `Overall tone ≥ ${HUMAN_TONE_PASS_THRESHOLD}`,
      passed: overall >= HUMAN_TONE_PASS_THRESHOLD,
      detail: `Score: ${overall}/${HUMAN_TONE_SCORE_MAX}`,
    },
    {
      name: "Verb diversity",
      passed: verb.score >= Math.round(SCORE_MAX.verbDiversity * 0.65),
      detail: `${verb.score}/${SCORE_MAX.verbDiversity}`,
    },
    {
      name: "Human context cues",
      passed: context.score >= Math.round(SCORE_MAX.humanContext * 0.5),
      detail: `${context.score}/${SCORE_MAX.humanContext}`,
    },
    {
      name: "No AI buzzword clutter",
      passed: buzz.score >= Math.round(SCORE_MAX.buzzwordControl * 0.7),
      detail: buzz.hits.length ? buzz.hits.slice(0, 3).join(", ") : "Clean",
    },
    {
      name: "Authentic formatting",
      passed: format.score >= Math.round(SCORE_MAX.formatAuthenticity * 0.75),
      detail: format.issues.length ? format.issues.join("; ") : "Clean",
    },
  ];

  const recommendations = buildHumanToneRecommendations({
    verb,
    structure,
    context,
    metrics,
    buzz,
    summary,
    format,
    bullets,
  });

  const summaryText = passed
    ? `Strong human tone (${overall}/${HUMAN_TONE_SCORE_MAX}) — varied wording, natural metrics, and recruiter-friendly style.`
    : `Human tone ${overall}/${HUMAN_TONE_SCORE_MAX} — ${recommendations[0] ?? "Add more natural, collaborative phrasing."}`;

  return {
    overall,
    passed,
    breakdown,
    recommendations,
    summary: summaryText,
    gates,
    flags: buzz.hits.slice(0, 8),
    algorithm: "human-tone-v1",
  };
}

function buildHumanToneRecommendations(input: {
  verb: { score: number; notes: string };
  structure: { score: number; notes: string };
  context: { score: number; notes: string };
  metrics: { score: number; notes: string };
  buzz: { score: number; hits: string[] };
  summary: { score: number; notes: string };
  format: { score: number; issues: string[] };
  bullets: string[];
}): string[] {
  const recs: string[] = [];

  if (input.verb.score < SCORE_MAX.verbDiversity * 0.65) {
    recs.push("Vary action verbs and sentence openings — avoid repeating the same verb or phrase across bullets.");
  }
  if (input.structure.score < SCORE_MAX.structureVariety * 0.65) {
    recs.push("Mix short and long bullets — uniform length reads robotic.");
  }
  if (input.context.score < SCORE_MAX.humanContext * 0.5) {
    recs.push("Add collaboration or context cues (e.g. coordinated with backend, refactored after an incident, balanced speed vs. scope).");
  }
  if (input.metrics.score < SCORE_MAX.naturalMetrics * 0.65) {
    recs.push("Use metrics in some bullets only — prefer specific units (ms, users, $) over generic percentages everywhere.");
  }
  if (input.buzz.hits.length > 0) {
    recs.push(`Replace buzzwords (${input.buzz.hits.slice(0, 3).join(", ")}) with plain, specific language.`);
  }
  if (input.summary.score < SCORE_MAX.summaryVoice * 0.7) {
    recs.push("Keep summary to 2–4 sentences, third-person, without buzzwords or em-dashes.");
  }
  if (input.format.issues.length > 0) {
    recs.push("Remove em-dashes, bracket labels, and first-person phrasing from bullets.");
  }

  return recs.slice(0, 6);
}
