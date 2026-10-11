import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { ApiError } from "@/lib/auth-api";
import type { GeneratedResumeContent, ResumeExperience, ResumeTemplateLayout } from "@/lib/resume-types";

/** One job slot from backend-parsed styled template (Mode 1). */
export type ResumeTemplateStructureJob = {
  company: string;
  role: string;
  dates: string;
  location?: string;
  /** Number of exp_section bullet slots in the DOCX for this job. */
  bulletCount: number;
  bulletSamples?: string[];
};

/** Authoritative template structure from backend — do not re-parse DOCX in the browser. */
export type ResumeTemplateStructure = {
  templateId?: string;
  fileName?: string;
  mode?: string;
  layout?: ResumeTemplateLayout;
  profileName?: string;
  headerTitle?: string;
  skillsSample?: string;
  jobs: ResumeTemplateStructureJob[];
};

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

function pickString(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeJob(raw: unknown): ResumeTemplateStructureJob | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const job = raw as Record<string, unknown>;
  const company = pickString(job, "company", "companyName", "employer");
  const role = pickString(job, "role", "title", "jobTitle");
  const dates = pickString(job, "dates", "date", "period", "company_period");
  const location = pickString(job, "location", "company_location") || undefined;
  const bulletCountRaw = job.bulletCount ?? job.bullet_count ?? job.expSectionCount;
  const bulletCount =
    typeof bulletCountRaw === "number" && Number.isFinite(bulletCountRaw)
      ? Math.max(0, Math.floor(bulletCountRaw))
      : Array.isArray(job.bullets)
        ? job.bullets.length
        : Array.isArray(job.bulletSamples)
          ? job.bulletSamples.length
          : 0;
  const bulletSamples = Array.isArray(job.bulletSamples)
    ? job.bulletSamples.map((s) => String(s).trim()).filter(Boolean)
    : undefined;

  if (!company && !role && !dates && bulletCount === 0) return null;

  return {
    company,
    role,
    dates,
    ...(location ? { location } : {}),
    bulletCount,
    ...(bulletSamples?.length ? { bulletSamples } : {}),
  };
}

export function normalizeTemplateStructure(
  data: Record<string, unknown> | null | undefined
): ResumeTemplateStructure | null {
  if (!data || typeof data !== "object") return null;

  const nested =
    data.structure && typeof data.structure === "object" && !Array.isArray(data.structure)
      ? (data.structure as Record<string, unknown>)
      : data;

  const jobsRaw = nested.jobs ?? nested.experiences ?? data.jobs;
  if (!Array.isArray(jobsRaw)) return null;

  const jobs = jobsRaw.map(normalizeJob).filter((j): j is ResumeTemplateStructureJob => Boolean(j));
  if (jobs.length === 0 && !pickString(nested, "templateId", "fileName")) {
    return null;
  }

  const layoutRaw = pickString(nested, "layout") || pickString(data, "layout");
  const layout: ResumeTemplateLayout | undefined =
    layoutRaw === "projects" || layoutRaw === "bullets" ? layoutRaw : undefined;

  return {
    templateId: pickString(nested, "templateId", "resumeTemplateId", "id") || undefined,
    fileName: pickString(nested, "fileName", "resumeTemplateFileName") || undefined,
    mode: pickString(nested, "mode") || undefined,
    layout,
    profileName: pickString(nested, "profileName", "name") || undefined,
    headerTitle: pickString(nested, "headerTitle", "title") || undefined,
    skillsSample: pickString(nested, "skillsSample", "skills") || undefined,
    jobs,
  };
}

/**
 * Load backend-parsed template structure (bullet slots, company_period, etc.).
 * Tries active → by id → profile resume-template.structure.
 */
export async function fetchResumeTemplateStructure(
  templateId?: string
): Promise<ResumeTemplateStructure | null> {
  const id = templateId?.trim();
  const candidates = [
    "/resume/templates/active/structure",
    ...(id ? [`/resume/templates/${encodeURIComponent(id)}/structure`] : []),
    "/auth/profile/resume-template",
    "/profile/resume-template",
  ];

  let lastError: Error | null = null;
  for (const path of candidates) {
    try {
      const res = await apiAuthFetch(`${API_BASE_URL}${path}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const data = await parseJson(res);
      if (!res.ok) {
        if (res.status === 404 || res.status === 405 || res.status === 501) {
          lastError = new ApiError(
            pickString(data, "message", "error") || `Structure unavailable (${res.status}).`,
            res.status
          );
          continue;
        }
        throw new ApiError(
          pickString(data, "message", "error") || `Template structure failed (${res.status}).`,
          res.status
        );
      }
      const structure = normalizeTemplateStructure(data);
      if (structure?.jobs.length) return structure;
      lastError = new ApiError("Template structure missing jobs.", 502);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501)) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  if (lastError) return null;
  return null;
}

/** Pad / align draft experiences to backend template job slots (Mode 1). */
export function alignContentWithTemplateStructure(
  content: GeneratedResumeContent,
  structure: ResumeTemplateStructure | null | undefined
): GeneratedResumeContent {
  const jobs = structure?.jobs;
  if (!jobs?.length) return content;

  const count = Math.max(content.experiences.length, jobs.length);
  const experiences: ResumeExperience[] = Array.from({ length: count }, (_, index) => {
    const exp = content.experiences[index];
    const job = jobs[index];
    const base: ResumeExperience = exp ?? {
      company: "",
      role: "",
      dates: "",
      bullets: [],
    };

    if (!job) return base;

    const slotCount = Math.max(0, job.bulletCount || 0);
    const existing = Array.isArray(base.bullets) ? base.bullets.map((b) => String(b)) : [];
    // Pad/clip to exact template bulletCount for editing UX (empty slots OK).
    const bullets =
      slotCount > 0
        ? [
            ...existing.slice(0, slotCount),
            ...Array.from({ length: Math.max(0, slotCount - existing.length) }, () => ""),
          ]
        : existing;

    return {
      ...base,
      // Frozen from template structure (never treat as AI-editable headers).
      company: job.company.trim() || base.company,
      role: job.role.trim() || base.role,
      dates: job.dates.trim() || base.dates,
      ...(job.location?.trim()
        ? { location: job.location.trim() }
        : base.location?.trim()
          ? { location: base.location.trim() }
          : {}),
      bullets,
    };
  });

  return {
    ...content,
    layout: structure?.layout ?? content.layout,
    experiences,
  };
}

export function templateJobBulletSlotCount(
  jobs: ResumeTemplateStructureJob[] | undefined,
  index: number,
  fallback: number
): number {
  const count = jobs?.[index]?.bulletCount;
  if (typeof count === "number" && count > 0) return count;
  return fallback;
}

/** Category line count from structure.skillsSample (not AI skills length). */
export function countTemplateSkillCategories(skillsSample?: string): number {
  if (!skillsSample?.trim()) return 0;
  return skillsSample.split(/\n+/).map((l) => l.trim()).filter(Boolean).length;
}
