import type {
  CompensationPeriod,
  CompensationType,
  Confidence,
  FieldSource,
  JobCheckCompany,
  JobCheckCompensation,
  JobCheckField,
  JobCheckResult,
  WorkArrangement,
} from "@/lib/job-check-types";

const SOURCES = new Set<FieldSource>(["stated", "inferred", "unknown"]);
const CONFIDENCES = new Set<Confidence>(["high", "medium", "low"]);
const WORK_ARRANGEMENTS = new Set<WorkArrangement>(["remote", "hybrid", "onsite", "unknown"]);
const PERIODS = new Set<NonNullable<CompensationPeriod>>([
  "hour",
  "day",
  "week",
  "month",
  "year",
  "project",
]);
const COMP_TYPES = new Set<NonNullable<CompensationType>>([
  "salary",
  "hourly",
  "contract",
  "equity",
  "other",
]);

function asString(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function asSource(value: unknown): FieldSource {
  return typeof value === "string" && SOURCES.has(value as FieldSource)
    ? (value as FieldSource)
    : "unknown";
}

function asConfidence(value: unknown): Confidence {
  return typeof value === "string" && CONFIDENCES.has(value as Confidence)
    ? (value as Confidence)
    : "low";
}

function asWorkArrangement(value: unknown): WorkArrangement {
  return typeof value === "string" && WORK_ARRANGEMENTS.has(value as WorkArrangement)
    ? (value as WorkArrangement)
    : "unknown";
}

function asPeriod(value: unknown): CompensationPeriod {
  if (value == null) return null;
  return typeof value === "string" && PERIODS.has(value as NonNullable<CompensationPeriod>)
    ? (value as NonNullable<CompensationPeriod>)
    : null;
}

function asCompType(value: unknown): CompensationType {
  if (value == null) return null;
  return typeof value === "string" && COMP_TYPES.has(value as NonNullable<CompensationType>)
    ? (value as NonNullable<CompensationType>)
    : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asStringArray(value: unknown, maxItems: number, maxLen = 120): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item, maxLen))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function parseField<T extends string>(
  raw: unknown,
  normalize?: (value: string) => T | null
): JobCheckField<T> {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawValue = asString(obj.value, 200);
  const normalized = rawValue && normalize ? normalize(rawValue) : (rawValue as T | null);
  return {
    value: normalized ?? null,
    source: asSource(obj.source),
    confidence: asConfidence(obj.confidence),
    evidence: asString(obj.evidence, 240),
  };
}

function parseCompany(raw: unknown, fallbackName: string): JobCheckCompany {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    name: asString(obj.name, 160) ?? fallbackName,
    location: parseField(obj.location),
    industry: parseField(obj.industry),
    mainWorkingLanguage: parseField(obj.mainWorkingLanguage),
  };
}

function parseCompensation(raw: unknown): JobCheckCompensation {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    mentioned: obj.mentioned === true,
    summary: asString(obj.summary, 240),
    currency: asString(obj.currency, 12),
    minAmount: asNumber(obj.minAmount),
    maxAmount: asNumber(obj.maxAmount),
    period: asPeriod(obj.period),
    type: asCompType(obj.type),
    benefits: asStringArray(obj.benefits, 5),
    rawQuote: asString(obj.rawQuote, 300),
    source: asSource(obj.source),
  };
}

export function parseJobCheckJson(raw: string, fallback: JobCheckRequestFallback): JobCheckResult | null {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;

    const employerRaw = parsed.employer;
    const clientRaw =
      parsed.client && typeof parsed.client === "object"
        ? (parsed.client as Record<string, unknown>)
        : {};
    const positionRaw =
      parsed.position && typeof parsed.position === "object"
        ? (parsed.position as Record<string, unknown>)
        : {};

    const clientCompanyRaw = clientRaw.company;
    const clientMentioned = clientRaw.mentioned === true && clientCompanyRaw != null;

    return {
      employer: parseCompany(employerRaw, fallback.companyName),
      client: {
        mentioned: clientMentioned,
        company: clientMentioned
          ? parseCompany(
              clientCompanyRaw,
              asString(
                clientCompanyRaw && typeof clientCompanyRaw === "object"
                  ? (clientCompanyRaw as Record<string, unknown>).name
                  : null,
                160
              ) ?? "Client"
            )
          : null,
      },
      position: {
        title: asString(positionRaw.title, 160) ?? fallback.jobTitle ?? "Job",
        workArrangement: parseField<WorkArrangement>(positionRaw.workArrangement, (value) =>
          asWorkArrangement(value.toLowerCase())
        ),
        mainWorkingLanguage: parseField(positionRaw.mainWorkingLanguage),
        secondaryLanguages: asStringArray(positionRaw.secondaryLanguages, 8, 40),
      },
      compensation: parseCompensation(parsed.compensation),
      notes: asStringArray(parsed.notes, 6, 240),
      warnings: asStringArray(parsed.warnings, 3, 240),
      overallConfidence: asConfidence(parsed.overallConfidence),
    };
  } catch {
    return null;
  }
}

export type JobCheckRequestFallback = {
  jobTitle: string;
  companyName: string;
};
