export type ResumeExperience = {
  company: string;
  role: string;
  dates: string;
  bullets: string[];
};

export type GeneratedResumeContent = {
  title: string;
  summary: string;
  skills: string;
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
