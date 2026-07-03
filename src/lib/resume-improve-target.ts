export type ResumeImproveTarget =
  | {
      id: string;
      kind: "ats-category";
      label: string;
      score: number;
      maxScore: number;
      notes: string;
    }
  | {
      id: string;
      kind: "ats-keywords";
      label: string;
      keywords: string[];
    }
  | {
      id: string;
      kind: "ats-recommendation";
      label: string;
      recommendation: string;
    }
  | {
      id: string;
      kind: "ats-gate";
      label: string;
      detail: string;
      passed: boolean;
    }
  | {
      id: string;
      kind: "custom-rule";
      label: string;
      rule: string;
      detail: string;
      category: string;
      passed: boolean;
    };

export function describeImproveTarget(target: ResumeImproveTarget): string {
  switch (target.kind) {
    case "ats-category":
      return `Improve ATS category "${target.label}" from ${target.score}/${target.maxScore}. Notes: ${target.notes || "No notes."}`;
    case "ats-keywords":
      return `Add missing or weak JD keywords naturally: ${target.keywords.join(", ")}.`;
    case "ats-recommendation":
      return `Apply this ATS recommendation: ${target.recommendation}`;
    case "ats-gate":
      return `Fix ATS pass gate "${target.label}". Current detail: ${target.detail}`;
    case "custom-rule":
      return `Fix custom rule "${target.rule}". Auditor detail: ${target.detail}`;
  }
}

export function buildImproveTargetInstruction(target: ResumeImproveTarget): string {
  const targetDescription = describeImproveTarget(target);
  const likelySections =
    target.kind === "ats-keywords"
      ? "title, skillsets, summary, and only one relevant experience sentence if needed"
      : target.kind === "custom-rule"
        ? "the field(s) mentioned or implied by the failed custom rule auditor detail"
        : target.kind === "ats-gate"
          ? "the specific section implied by the failed gate detail"
          : "the field(s) most responsible for this score item";

  return [
    "Targeted Improve button request:",
    targetDescription,
    "",
    "Required process:",
    "1. Read the entire previous draft first.",
    `2. Identify the smallest affected resume field(s) from the whole draft. Likely search area: ${likelySections}.`,
    "3. Update only the minimum sentence, phrase, keyword list, or field needed to improve the selected score item.",
    "4. Copy every unrelated field exactly from the previous draft, including wording, punctuation, markdown bold markers, order, and line breaks.",
    "5. Do not rewrite the whole resume, do not rephrase high-scoring sections, and do not change unrelated projects/bullets.",
    "6. If the selected feedback can be solved in Skillsets or Summary, prefer that over changing experience content.",
    "",
    "Return the full JSON only because the API requires it, but unchanged fields must be byte-for-byte identical to the previous draft.",
  ].join("\n");
}
