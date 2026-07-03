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
