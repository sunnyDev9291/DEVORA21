"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ProfileFileUpload from "@/components/profile/ProfileFileUpload";
import UserAvatar from "@/components/ui/UserAvatar";
import { processAvatarFile } from "@/lib/avatar-image";
import { getApiErrorMessage } from "@/lib/auth-api";
import {
  ALL_JOB_CRAWL_PLATFORMS,
  JOB_CRAWL_PLATFORM_HINT,
  JOB_CRAWL_PLATFORM_LABEL,
  JOB_CRAWL_PLATFORM_PLACEHOLDER,
  JOB_CRAWL_PLATFORM_VALIDATOR,
  isJobCrawlUrlPlatform,
  mergeListingUrls,
  type JobCrawlPlatform,
} from "@/lib/builtin-crawl-types";
import { AUTH_LINKS } from "@/lib/constants";
import { readPromptFile, validateDocxFile } from "@/lib/profile-file";
import { resolveListingUrls, resolveUserNames } from "@/lib/user-profile";
import { superAdminApi } from "@/lib/super-admin-api";
import type { User } from "@/types/auth";
import {
  saBtnGhost,
  saBtnPrimary,
  saCard,
  saField,
  saLabel,
  saMono,
} from "@/components/super-admin/resume-dashboard-styles";

const fieldClass = saField;

type SuperAdminProfileEditorProps = {
  userId: string;
  /** When true, hide page-level back links (used in split-pane profiles UI). */
  embedded?: boolean;
};

export default function SuperAdminProfileEditor({
  userId,
  embedded = false,
}: SuperAdminProfileEditorProps) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [resumeTemplateFile, setResumeTemplateFile] = useState<File | null>(null);
  const [resumeTemplateFileName, setResumeTemplateFileName] = useState("");
  const [promptFile, setPromptFile] = useState<File | null>(null);
  const [pendingPromptName, setPendingPromptName] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [promptFileName, setPromptFileName] = useState("");
  const [listingUrls, setListingUrls] = useState<Record<JobCrawlPlatform, string>>(() =>
    mergeListingUrls(null)
  );
  const [resumeBuilderEnabled, setResumeBuilderEnabled] = useState(false);

  async function hydrate(next: User) {
    setUser(next);
    const names = resolveUserNames(next);
    setFirstName(names.firstName);
    setLastName(names.lastName);
    setAvatarPreviewUrl(next.avatar?.trim() || "");
    setAvatarFile(null);
    setResumeTemplateFile(null);
    setResumeTemplateFileName(next.resumeTemplateFileName || "");
    setListingUrls(mergeListingUrls(resolveListingUrls(next)));
    setResumeBuilderEnabled(Boolean(next.resumeBuilderEnabled));
    setPromptFile(null);
    setPendingPromptName("");
    setPromptFileName(next.promptFileName || "");

    try {
      const prompt = await superAdminApi.fetchPrompt(next.id);
      setCustomPrompt(prompt.content);
      if (prompt.fileName) setPromptFileName(prompt.fileName);
    } catch {
      setCustomPrompt("");
    }

    try {
      const template = await superAdminApi.fetchResumeTemplate(next.id);
      setResumeTemplateFileName(template.fileName);
    } catch {
      // keep profile filename
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const next = await superAdminApi.getUser(userId);
        if (!cancelled) await hydrate(next);
      } catch (err) {
        if (!cancelled) {
          setUser(null);
          setError(getApiErrorMessage(err, "Could not load user profile."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleAvatarFile(file: File) {
    setError("");
    setUploading(true);
    try {
      const { dataUrl } = await processAvatarFile(file);
      setAvatarFile(file);
      setAvatarPreviewUrl(dataUrl);
    } catch (err) {
      setError((err as Error).message || "Could not process image.");
    } finally {
      setUploading(false);
    }
  }

  async function handleResumeTemplateFile(file: File) {
    setError("");
    setUploading(true);
    try {
      validateDocxFile(file);
      setResumeTemplateFile(file);
      setResumeTemplateFileName(file.name);
    } catch (err) {
      setError((err as Error).message || "Could not use that template.");
    } finally {
      setUploading(false);
    }
  }

  async function handlePromptFile(file: File) {
    if (!user) return;
    setError("");
    setMessage("");
    setUploading(true);
    try {
      const content = await readPromptFile(file);
      setPromptFile(file);
      setPendingPromptName(file.name);
      setCustomPrompt(content);
      const result = await superAdminApi.uploadPromptFile(user.id, file, content);
      setCustomPrompt(result.content);
      setPromptFileName(result.fileName || file.name);
      setPromptFile(null);
      setPendingPromptName("");
      setMessage(
        result.serverMatchesUpload
          ? "Prompt uploaded and verified."
          : "Prompt uploaded (server may still show an older copy)."
      );
      const refreshed = await superAdminApi.getUser(user.id);
      setUser(refreshed);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not upload prompt file."));
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");
    setMessage("");

    for (const platform of ALL_JOB_CRAWL_PLATFORMS) {
      const value = listingUrls[platform]?.trim() ?? "";
      if (value && !JOB_CRAWL_PLATFORM_VALIDATOR[platform](value)) {
        setError(
          isJobCrawlUrlPlatform(platform)
            ? `Invalid ${JOB_CRAWL_PLATFORM_LABEL[platform]} listing URL.`
            : `Invalid ${JOB_CRAWL_PLATFORM_LABEL[platform]} country.`
        );
        setSaving(false);
        return;
      }
    }

    try {
      const updated = await superAdminApi.updateUser(user.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        avatarFile,
        avatarDataUrl: avatarPreviewUrl,
        resumeTemplateFile,
        listingUrls: mergeListingUrls(listingUrls),
        resumeBuilderEnabled,
      });
      await hydrate(updated);
      setMessage("Profile saved.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not save profile."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={`${embedded ? "mt-6" : "mt-10"} flex justify-center py-16`}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-300 border-t-teal-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`${embedded ? "mt-0" : "mt-8"} space-y-4`}>
        <div
          className="sa-alert px-4 py-3 font-[family-name:var(--font-sa-mono)] text-xs"
          role="alert"
        >
          {error || "User not found."}
        </div>
        {!embedded ? (
          <Link
            href={`${AUTH_LINKS.superAdmin}/profiles`}
            className="inline-flex font-[family-name:var(--font-sa-mono)] text-xs text-teal-700 underline-offset-2 hover:underline"
          >
            ← Back to profiles
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      className={`${saCard} ${embedded ? "mt-0" : "mt-8"} space-y-8 p-6 sm:p-8`}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-3">
          <UserAvatar
            firstName={firstName}
            lastName={lastName}
            email={user.email}
            avatarUrl={avatarPreviewUrl || user.avatar}
            size="lg"
          />
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleAvatarFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={uploading || saving}
            onClick={() => avatarInputRef.current?.click()}
            className={`${saBtnGhost} h-9 px-3 text-[10px]`}
          >
            {uploading ? "Uploading…" : "Change photo"}
          </button>
        </div>
        <div className={`min-w-0 flex-1 space-y-2 ${saMono} text-xs text-slate-500`}>
          <p className={saLabel}>Target user</p>
          <p className="text-sm text-slate-900">{user.email}</p>
          <p>id · {user.id}</p>
          <p>email verified · {user.emailVerified ? "yes" : "no"}</p>
          <p>onboarding · {user.onboardingCompleted ? "complete" : "incomplete"}</p>
          <p>
            created ·{" "}
            {user.createdAt
              ? new Date(user.createdAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "—"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="sa-first-name"
            className="mb-1.5 block font-[family-name:var(--font-sa-mono)] text-[10px] uppercase tracking-[0.16em] text-slate-500"
          >
            First name
          </label>
          <input
            id="sa-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={fieldClass}
            disabled={saving}
          />
        </div>
        <div>
          <label
            htmlFor="sa-last-name"
            className="mb-1.5 block font-[family-name:var(--font-sa-mono)] text-[10px] uppercase tracking-[0.16em] text-slate-500"
          >
            Last name
          </label>
          <input
            id="sa-last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={fieldClass}
            disabled={saving}
          />
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="sa-email"
            className="mb-1.5 block font-[family-name:var(--font-sa-mono)] text-[10px] uppercase tracking-[0.16em] text-slate-500"
          >
            Email (read-only)
          </label>
          <input id="sa-email" value={user.email} readOnly className={`${fieldClass} opacity-70`} />
        </div>
      </div>

      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={resumeBuilderEnabled}
            onChange={(e) => setResumeBuilderEnabled(e.target.checked)}
            disabled={saving}
            className="mt-0.5 h-4 w-4 accent-teal-700"
          />
          <span>
            <span className={`${saMono} block text-xs font-semibold uppercase tracking-wider text-slate-900`}>
              Resume builder enabled
            </span>
            <span className={`${saMono} mt-1 block text-[11px] text-slate-500`}>
              Ops toggle — unlocks /resume for this account.
            </span>
          </span>
        </label>
      </div>

      <div>
        <h3 className="font-[family-name:var(--font-sa-mono)] text-[10px] uppercase tracking-[0.16em] text-teal-700/80">
          Job crawl settings
        </h3>
        <div className="mt-4 space-y-4">
          {ALL_JOB_CRAWL_PLATFORMS.map((platform) => {
            const countryOnly = !isJobCrawlUrlPlatform(platform);
            return (
              <div key={platform}>
                <label
                  htmlFor={`sa-listing-${platform}`}
                  className="mb-1.5 block font-[family-name:var(--font-sa-mono)] text-[10px] uppercase tracking-[0.16em] text-slate-500"
                >
                  {JOB_CRAWL_PLATFORM_LABEL[platform]}
                  {countryOnly ? " country" : ""}
                </label>
                <input
                  id={`sa-listing-${platform}`}
                  type={countryOnly ? "text" : "url"}
                  value={listingUrls[platform]}
                  onChange={(e) =>
                    setListingUrls((current) => ({ ...current, [platform]: e.target.value }))
                  }
                  placeholder={JOB_CRAWL_PLATFORM_PLACEHOLDER[platform]}
                  className={fieldClass}
                  disabled={saving}
                  spellCheck={false}
                />
                <p className="mt-1.5 font-[family-name:var(--font-sa-mono)] text-[11px] text-slate-500">
                  {JOB_CRAWL_PLATFORM_HINT[platform]}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="font-[family-name:var(--font-sa-mono)] text-[10px] uppercase tracking-[0.16em] text-teal-700/80">
          Resume template
        </h3>
        {resumeTemplateFileName ? (
          <p className="mt-2 font-[family-name:var(--font-sa-mono)] text-xs text-emerald-700/90">
            Current: {resumeTemplateFileName}
          </p>
        ) : null}
        <div className="mt-3">
          <ProfileFileUpload
            id="sa-resume-template"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            label="Upload resume template"
            hint=".docx only · max 10 MB"
            fileName={resumeTemplateFile?.name}
            uploading={uploading}
            disabled={saving}
            onFile={handleResumeTemplateFile}
          />
        </div>
      </div>

      <div>
        <h3 className="font-[family-name:var(--font-sa-mono)] text-[10px] uppercase tracking-[0.16em] text-teal-700/80">
          Writing prompt
        </h3>
        <div className="mt-3">
          <ProfileFileUpload
            id="sa-prompt-file"
            accept=".txt,.md,.json,text/plain,text/markdown,application/json"
            label="Replace prompt file"
            hint=".txt, .md, or .json · uploads immediately"
            fileName={pendingPromptName || undefined}
            uploading={uploading}
            disabled={saving}
            onFile={handlePromptFile}
          />
        </div>
        <p className="mt-2 font-[family-name:var(--font-sa-mono)] text-[11px] text-slate-500">
          {promptFileName ? `Stored prompt · ${promptFileName}` : "No prompt file name on profile."}
        </p>
        {customPrompt.trim() ? (
          <textarea
            readOnly
            value={customPrompt}
            rows={10}
            className="mt-3 w-full resize-y border border-[#2a3a4a] bg-slate-50 px-3 py-2.5 font-[family-name:var(--font-sa-mono)] text-[11px] leading-relaxed text-slate-600 outline-none"
          />
        ) : null}
      </div>

      {error ? (
        <div
          className="sa-alert px-4 py-3 font-[family-name:var(--font-sa-mono)] text-xs"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-[family-name:var(--font-sa-mono)] text-xs text-emerald-800"
          role="status"
        >
          {message}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving || uploading} className={saBtnPrimary}>
          {saving ? "Saving…" : "Save profile"}
        </button>
        {!embedded ? (
          <Link href={`${AUTH_LINKS.superAdmin}/profiles`} className={saBtnGhost}>
            ← Profiles
          </Link>
        ) : null}
      </div>
    </form>
  );
}
