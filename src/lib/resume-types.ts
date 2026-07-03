export type ResumeProject = {
  name: string;
  businessChallenge: string;
  assignedResponsibility: string;
  action: string;
  result: string;
};

/** bullets = achievement lines; projects = BAR-style project blocks per company */
export type ResumeTemplateLayout = "bullets" | "projects";

export type ResumeExperience = {
  company: string;
  role: string;
  dates: string;
  /** Used when layout is bullets (or as ATS fallback text). */
  bullets: string[];
  /** Used when layout is projects — one block per project under the company. */
  projects?: ResumeProject[];
};

export type GeneratedResumeContent = {
  title: string;
  summary: string;
  skills: string;
  layout?: ResumeTemplateLayout;
  experiences: ResumeExperience[];
};

export type ResumeGenerateResponse = {
  content: GeneratedResumeContent;
  templateName: string;
};

export type ResumeBuildResponse = {
  templateName: string;
  docxBase64: string;
  fileName: string;
};

export type ResumeArchiveResponse = {
  resumeName: string;
  pdfFileName: string;
  pdfBase64: string;
};

export type AtsScoreBreakdown = {
  category: string;
  score: number;
  maxScore: number;
  notes: string;
};

export type AtsPassGate = {
  name: string;
  passed: boolean;
  detail: string;
};

export type AtsScoreResult = {
  overall: number;
  passed: boolean;
  breakdown: AtsScoreBreakdown[];
  matchedKeywords: string[];
  missingKeywords: string[];
  recommendations: string[];
  summary: string;
  /** Strict algorithm pass gates — all must pass for `passed: true`. */
  gates?: AtsPassGate[];
  mustHaveCoverage?: number;
  algorithm?: string;
};

export type RuleKeepCheck = {
  id: string;
  rule: string;
  category: string;
  passed: boolean;
  detail: string;
};

export type RuleKeepScoreResult = {
  overall: number;
  passed: boolean;
  totalRules: number;
  passedRules: number;
  rules: RuleKeepCheck[];
  recommendations: string[];
  summary: string;
  algorithm?: string;
};

/** Combined ATS + Rule Keep score shown as one resume quality metric. */
export type ResumeUnifiedScoreResult = {
  overall: number;
  passed: boolean;
  summary: string;
  ats: AtsScoreResult;
  ruleKeep: RuleKeepScoreResult;
  hasRules: boolean;
};
