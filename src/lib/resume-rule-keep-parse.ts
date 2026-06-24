import { createHash } from "crypto";
import { getCachedValue, setCachedValue } from "@/lib/server-cache";

export type ParsedPromptRule = {
  id: string;
  rule: string;
  category: string;
};

const MAX_RULES = 48;

const SKIP_LINE = new RegExp(
  [
    "^\\*{2,}",
    "^examples?\\s*$",
    "\\u2192",
    "^\\s*Initial tech items",
    "^Extract (core|all)",
    "^Output (each|the final|final list)",
    "^Make final list",
    "^Add 1st,2nd",
    "^If [Tt]here aren't",
    "^If it is",
    "^Before make final",
    "^After reorder",
    "^After output final",
    "^When new prompt",
    "^Let's make the resume",
    "^You are a",
    "^In case that",
    "^3rd-type items",
    "^Absolutely 1st",
    '^Avoid "HTML',
    "^Participated Project",
    "^Implemented functionality",
    "^Industry domain",
    "^Job title\\s*:",
  ].join("|"),
  "i"
);

const COMPANY_META =
  /^-\s+[A-Za-z(].*\(\d{1,2}\/\d{4}/;

function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt.trim()).digest("hex").slice(0, 24);
}

function detectCategory(line: string, current: string): string {
  if (/^\*{2,}/.test(line)) {
    const cleaned = line.replace(/\*/g, "").trim();
    if (cleaned.length > 2) return cleaned.slice(0, 48);
  }
  return current;
}

function isCheckableRule(line: string): boolean {
  const t = line.trim();
  if (t.length < 10 || t.length > 420) return false;
  if (SKIP_LINE.test(t)) return false;
  if (COMPANY_META.test(t)) return false;
  if (/^sentence number\s*:/i.test(t)) return false;
  if (/^sentences with/i.test(t)) return false;
  if (/^Hate style|^Like style|^Final experience/i.test(t)) return false;

  if (t.startsWith("- ")) return true;
  if (/^(Summary|JOB title|Resume file name)/i.test(t)) return true;
  if (/\bmust\b|\bmustn't\b|\bnever\b|\balways\b|\bdo not\b|\bdon't\b/i.test(t)) return true;
  if (/^(Follow these|Use the style|Keep technical|Add human|Use metrics|Vary sentence|Consolidate|Sentence must)/i.test(t)) return true;

  return false;
}

function parseRulesFromPromptText(prompt: string): ParsedPromptRule[] {
  const rules: ParsedPromptRule[] = [];
  let category = "General";
  let index = 0;

  for (const rawLine of prompt.split(/\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^\*{3,}/.test(line)) {
      category = detectCategory(line, category);
      continue;
    }

    if (!isCheckableRule(line)) continue;

    const rule = line.startsWith("- ") ? line.slice(2).trim() : line;
    if (rules.some((r) => r.rule === rule)) continue;

    rules.push({
      id: `r${index + 1}`,
      rule,
      category,
    });
    index += 1;
    if (rules.length >= MAX_RULES) break;
  }

  return rules;
}

export async function getParsedPromptRules(customPrompt: string): Promise<ParsedPromptRule[]> {
  const trimmed = customPrompt.trim();
  if (!trimmed) return [];

  const key = `prompt-rules:${hashPrompt(trimmed)}`;
  const cached = await getCachedValue<ParsedPromptRule[]>(key);
  if (cached?.length) return cached;

  const rules = parseRulesFromPromptText(trimmed);
  if (rules.length > 0) {
    await setCachedValue(key, rules);
  }
  return rules;
}

export function buildEmptyRuleKeepSummary(): string {
  return "Load extra instructions (saved prompt) to run Rule Keep checks against your prompt rules.";
}
