export type FieldSource = "stated" | "inferred" | "unknown";
export type Confidence = "high" | "medium" | "low";
export type WorkArrangement = "remote" | "hybrid" | "onsite" | "unknown";
export type CompensationPeriod = "hour" | "day" | "week" | "month" | "year" | "project" | null;
export type CompensationType = "salary" | "hourly" | "contract" | "equity" | "other" | null;

export type JobCheckField<T = string> = {
  value: T | null;
  source: FieldSource;
  confidence: Confidence;
  evidence: string | null;
};

export type JobCheckCompany = {
  name: string;
  location: JobCheckField;
  industry: JobCheckField;
  mainWorkingLanguage: JobCheckField;
};

export type JobCheckCompensation = {
  mentioned: boolean;
  summary: string | null;
  currency: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  period: CompensationPeriod;
  type: CompensationType;
  benefits: string[];
  rawQuote: string | null;
  source: FieldSource;
};

export type JobCheckResult = {
  employer: JobCheckCompany;
  client: {
    mentioned: boolean;
    company: JobCheckCompany | null;
  };
  position: {
    title: string;
    workArrangement: JobCheckField<WorkArrangement>;
    mainWorkingLanguage: JobCheckField;
    secondaryLanguages: string[];
  };
  compensation: JobCheckCompensation;
  notes: string[];
  warnings: string[];
  overallConfidence: Confidence;
};

export type JobCheckRequest = {
  jobTitle?: string;
  companyName: string;
  jobDescription?: string;
  userId?: string;
};
