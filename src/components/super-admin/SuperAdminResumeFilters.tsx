"use client";

import type { AdminDatePreset, AdminResumeFilters } from "@/lib/super-admin-resumes-api";
import {
  saBtnGhost,
  saBtnPrimary,
  saCard,
  saChip,
  saChipActive,
  saField,
  saLabel,
} from "@/components/super-admin/resume-dashboard-styles";

export type ResumeFilterState = {
  q: string;
  company: string;
  jobTitle: string;
  jobDescription: string;
  profileName: string;
  profileId: string;
  preset: AdminDatePreset;
  from: string;
  to: string;
};

export const DEFAULT_RESUME_FILTERS: ResumeFilterState = {
  q: "",
  company: "",
  jobTitle: "",
  jobDescription: "",
  profileName: "",
  profileId: "",
  preset: "month",
  from: "",
  to: "",
};

type ProfileOption = { id: string; label: string };

type SuperAdminResumeFiltersProps = {
  value: ResumeFilterState;
  onChange: (next: ResumeFilterState) => void;
  onApply: () => void;
  profiles?: ProfileOption[];
  showKeywordFields?: boolean;
  applying?: boolean;
};

const PRESETS: { id: AdminDatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom" },
];

export function filtersToApi(value: ResumeFilterState): AdminResumeFilters {
  return {
    q: value.q.trim() || undefined,
    company: value.company.trim() || undefined,
    jobTitle: value.jobTitle.trim() || undefined,
    jobDescription: value.jobDescription.trim() || undefined,
    profileName: value.profileName.trim() || undefined,
    profileId: value.profileId.trim() || undefined,
    preset: value.preset,
    from: value.preset === "custom" ? value.from.trim() || undefined : undefined,
    to: value.preset === "custom" ? value.to.trim() || undefined : undefined,
  };
}

export default function SuperAdminResumeFilters({
  value,
  onChange,
  onApply,
  profiles = [],
  showKeywordFields = true,
  applying = false,
}: SuperAdminResumeFiltersProps) {
  const set = <K extends keyof ResumeFilterState>(key: K, next: ResumeFilterState[K]) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <div className={`${saCard} p-5 sm:p-6`}>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const active = value.preset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => set("preset", preset.id)}
              className={active ? saChipActive : saChip}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {value.preset === "custom" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="sa-resume-from" className={saLabel}>
              From (YYYY-MM-DD)
            </label>
            <input
              id="sa-resume-from"
              type="date"
              value={value.from}
              onChange={(e) => set("from", e.target.value)}
              className={saField}
            />
          </div>
          <div>
            <label htmlFor="sa-resume-to" className={saLabel}>
              To (YYYY-MM-DD)
            </label>
            <input
              id="sa-resume-to"
              type="date"
              value={value.to}
              onChange={(e) => set("to", e.target.value)}
              className={saField}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="sa-resume-profile" className={saLabel}>
            Profile
          </label>
          {profiles.length ? (
            <select
              id="sa-resume-profile"
              value={value.profileId}
              onChange={(e) => set("profileId", e.target.value)}
              className={saField}
            >
              <option value="">All profiles</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="sa-resume-profile"
              value={value.profileId}
              onChange={(e) => set("profileId", e.target.value)}
              className={saField}
              placeholder="Profile / user id"
              spellCheck={false}
            />
          )}
        </div>

        <div>
          <label htmlFor="sa-resume-profile-name" className={saLabel}>
            Profile name
          </label>
          <input
            id="sa-resume-profile-name"
            value={value.profileName}
            onChange={(e) => set("profileName", e.target.value)}
            className={saField}
            placeholder="Franco…"
            spellCheck={false}
          />
        </div>
      </div>

      {showKeywordFields ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="sa-resume-q" className={saLabel}>
              Keywords (multi — company, title, JD, profile)
            </label>
            <input
              id="sa-resume-q"
              value={value.q}
              onChange={(e) => set("q", e.target.value)}
              className={saField}
              placeholder="Vantum QA Tester…"
              spellCheck={false}
            />
          </div>
          <div>
            <label htmlFor="sa-resume-company" className={saLabel}>
              Company
            </label>
            <input
              id="sa-resume-company"
              value={value.company}
              onChange={(e) => set("company", e.target.value)}
              className={saField}
              spellCheck={false}
            />
          </div>
          <div>
            <label htmlFor="sa-resume-title" className={saLabel}>
              Job title
            </label>
            <input
              id="sa-resume-title"
              value={value.jobTitle}
              onChange={(e) => set("jobTitle", e.target.value)}
              className={saField}
              spellCheck={false}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="sa-resume-jd" className={saLabel}>
              Job description contains
            </label>
            <input
              id="sa-resume-jd"
              value={value.jobDescription}
              onChange={(e) => set("jobDescription", e.target.value)}
              className={saField}
              spellCheck={false}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onApply} disabled={applying} className={saBtnPrimary}>
          {applying ? "Loading…" : "Apply filters"}
        </button>
        <button
          type="button"
          disabled={applying}
          onClick={() => onChange({ ...DEFAULT_RESUME_FILTERS })}
          className={saBtnGhost}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
