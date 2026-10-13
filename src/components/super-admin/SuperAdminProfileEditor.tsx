"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ProfileFileUpload from "@/components/profile/ProfileFileUpload";
import ResumeTemplatePreviewButton from "@/components/ui/ResumeTemplatePreviewButton";
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

type SectionKey = "identity" | "access" | "crawl" | "template" | "prompt" | "danger";

type SuperAdminProfileEditorProps = {
  userId: string;
  /** When true, hide page-level back links (used in split-pane profiles UI). */
  embedded?: boolean;
  /** Called after a successful profile deletion so the parent can refresh the list. */
  onDeleted?: (userId: string) => void;
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${saCard} space-y-4 p-5 sm:p-6`}>
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
        {description ? (
          <p className={`${saMono} mt-1 text-[11px] leading-relaxed text-slate-500`}>
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function SectionFooter({
  busy,
  label,
  busyLabel = "Saving…",
  onSave,
  tone = "primary",
}: {
  busy: boolean;
  label: string;
  busyLabel?: string;
  onSave: () => void;
  tone?: "primary" | "danger";
}) {
  const className =
    tone === "danger"
      ? "inline-flex h-10 items-center justify-center rounded-xl border border-rose-300 bg-rose-50 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-800 transition hover:bg-rose-100 disabled:opacity-50"
      : saBtnPrimary;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
      <button type="button" disabled={busy} onClick={onSave} className={className}>
        {busy ? busyLabel : label}
      </button>
    </div>
  );
}

export default function SuperAdminProfileEditor({
  userId,
  embedded = false,
  onDeleted,
}: SuperAdminProfileEditorProps) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [resumeTemplateFile, setResumeTemplateFile] = useState<File | null>(null);
  const [resumeTemplateFileName, setResumeTemplateFileName] = useState("");
  const [templateBase64, setTemplateBase64] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [pendingPromptName, setPendingPromptName] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [promptFileName, setPromptFileName] = useState("");
  const [listingUrls, setListingUrls] = useState<Record<JobCrawlPlatform, string>>(() =>
    mergeListingUrls(null)
  );
  const [resumeBuilderEnabled, setResumeBuilderEnabled] = useState(false);

  const busy = savingSection !== null || uploading;

  const clearFlash = () => {
    setError("");
    setMessage("");
  };

  async function hydrate(next: User) {
    setUser(next);
    const names = resolveUserNames(next);
    setFirstName(names.firstName);
    setLastName(names.lastName);
    setAvatarPreviewUrl(next.avatar?.trim() || "");
    setAvatarFile(null);
    setResumeTemplateFile(null);
    setResumeTemplateFileName(next.resumeTemplateFileName || "");
    setTemplateBase64(null);
    setTemplateId(next.resumeTemplateId?.trim() || null);
    setListingUrls(mergeListingUrls(resolveListingUrls(next)));
    setResumeBuilderEnabled(Boolean(next.resumeBuilderEnabled));
    setPendingPromptName("");
    setPromptFileName(next.promptFileName || "");
    setDeleteConfirm("");

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
      setTemplateBase64(template.templateBase64 ?? null);
      setTemplateId(template.templateId ?? null);
    } catch {
      // keep profile filename / id
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      clearFlash();
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

  const fetchAdminTemplatePdf = useCallback(async () => {
    return superAdminApi.fetchResumeTemplatePreviewPdf(userId, templateId ?? undefined);
  }, [userId, templateId]);

  async function handleAvatarFile(file: File) {
    clearFlash();
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
    clearFlash();
    setUploading(true);
    try {
      validateDocxFile(file);
      setResumeTemplateFile(file);
      setResumeTemplateFileName(file.name);
      setTemplateBase64(null);
    } catch (err) {
      setError((err as Error).message || "Could not use that template.");
    } finally {
      setUploading(false);
    }
  }

  async function handlePromptFile(file: File) {
    if (!user) return;
    clearFlash();
    setUploading(true);
    try {
      const content = await readPromptFile(file);
      setPendingPromptName(file.name);
      setCustomPrompt(content);
      const result = await superAdminApi.uploadPromptFile(user.id, file, content);
      setCustomPrompt(result.content);
      setPromptFileName(result.fileName || file.name);
      setPendingPromptName("");
      setMessage(
        result.serverMatchesUpload
          ? "Prompt file uploaded and verified."
          : "Prompt file uploaded (server may still show an older copy)."
      );
      const refreshed = await superAdminApi.getUser(user.id);
      setUser(refreshed);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not upload prompt file."));
    } finally {
      setUploading(false);
    }
  }

  async function runSectionSave(section: SectionKey, action: () => Promise<void>, okMessage: string) {
    if (!user) return;
    setSavingSection(section);
    clearFlash();
    try {
      await action();
      setMessage(okMessage);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not save."));
    } finally {
      setSavingSection(null);
    }
  }

  async function saveIdentity() {
    await runSectionSave(
      "identity",
      async () => {
        const updated = await superAdminApi.updateUser(user!.id, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          avatarFile,
          avatarDataUrl: avatarPreviewUrl,
        });
        await hydrate(updated);
      },
      "Identity saved."
    );
  }

  async function saveAccess() {
    await runSectionSave(
      "access",
      async () => {
        const updated = await superAdminApi.updateUser(user!.id, {
          resumeBuilderEnabled,
        });
        await hydrate(updated);
      },
      "Resume builder access saved."
    );
  }

  async function saveCrawl() {
    for (const platform of ALL_JOB_CRAWL_PLATFORMS) {
      const value = listingUrls[platform]?.trim() ?? "";
      if (value && !JOB_CRAWL_PLATFORM_VALIDATOR[platform](value)) {
        setError(
          isJobCrawlUrlPlatform(platform)
            ? `Invalid ${JOB_CRAWL_PLATFORM_LABEL[platform]} listing URL.`
            : `Invalid ${JOB_CRAWL_PLATFORM_LABEL[platform]} country.`
        );
        return;
      }
    }
    await runSectionSave(
      "crawl",
      async () => {
        const updated = await superAdminApi.updateUser(user!.id, {
          listingUrls: mergeListingUrls(listingUrls),
        });
        await hydrate(updated);
      },
      "Job crawl settings saved."
    );
  }

  async function saveTemplate() {
    if (!resumeTemplateFile) {
      setError("Choose a .docx template file before saving this section.");
      return;
    }
    await runSectionSave(
      "template",
      async () => {
        const updated = await superAdminApi.updateUser(user!.id, {
          resumeTemplateFile,
        });
        await hydrate(updated);
      },
      "Resume template saved."
    );
  }

  async function savePrompt() {
    if (!customPrompt.trim()) {
      setError("Prompt cannot be empty.");
      return;
    }
    await runSectionSave(
      "prompt",
      async () => {
        const saved = await superAdminApi.savePrompt(
          user!.id,
          customPrompt,
          promptFileName || undefined
        );
        setCustomPrompt(saved.content);
        if (saved.fileName) setPromptFileName(saved.fileName);
        const refreshed = await superAdminApi.getUser(user!.id);
        setUser(refreshed);
      },
      "Prompt saved."
    );
  }

  async function deleteProfile() {
    if (!user) return;
    if (deleteConfirm.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      setError(`Type ${user.email} to confirm deletion.`);
      return;
    }
    setSavingSection("danger");
    clearFlash();
    try {
      const deletedId = user.id;
      await superAdminApi.deleteUser(deletedId);
      setMessage("Profile deleted.");
      onDeleted?.(deletedId);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete profile."));
    } finally {
      setSavingSection(null);
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
        <div className="sa-alert px-4 py-3 font-[family-name:var(--font-sa-mono)] text-xs" role="alert">
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

  const canPreviewTemplate = Boolean(
    resumeTemplateFile || templateBase64 || templateId
  );

  return (
    <div className={`${embedded ? "mt-0" : "mt-8"} space-y-4`}>
      {error ? (
        <div className="sa-alert px-4 py-3 font-[family-name:var(--font-sa-mono)] text-xs" role="alert">
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

      {/* Identity */}
      <Section title="Identity" description="Name and avatar for this account.">
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
              disabled={busy}
              onClick={() => avatarInputRef.current?.click()}
              className={`${saBtnGhost} h-9 px-3 text-[10px]`}
            >
              {uploading ? "Processing…" : "Change photo"}
            </button>
          </div>
          <div className={`min-w-0 flex-1 space-y-2 ${saMono} text-xs text-slate-500`}>
            <p className={saLabel}>Target user</p>
            <p className="text-sm text-slate-900">{user.email}</p>
            <p>id · {user.id}</p>
            <p>email verified · {user.emailVerified ? "yes" : "no"}</p>
            <p>onboarding · {user.onboardingCompleted ? "complete" : "incomplete"}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="sa-first-name" className={saLabel}>
              First name
            </label>
            <input
              id="sa-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={fieldClass}
              disabled={busy}
            />
          </div>
          <div>
            <label htmlFor="sa-last-name" className={saLabel}>
              Last name
            </label>
            <input
              id="sa-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={fieldClass}
              disabled={busy}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="sa-email" className={saLabel}>
              Email (read-only)
            </label>
            <input id="sa-email" value={user.email} readOnly className={`${fieldClass} opacity-70`} />
          </div>
        </div>
        <SectionFooter
          busy={savingSection === "identity"}
          label="Save identity"
          onSave={() => void saveIdentity()}
        />
      </Section>

      {/* Access */}
      <Section title="Resume builder access" description="Ops toggle for /resume.">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4">
          <input
            type="checkbox"
            checked={resumeBuilderEnabled}
            onChange={(e) => setResumeBuilderEnabled(e.target.checked)}
            disabled={busy}
            className="mt-0.5 h-4 w-4 accent-teal-700"
          />
          <span>
            <span className={`${saMono} block text-xs font-semibold uppercase tracking-wider text-slate-900`}>
              Resume builder enabled
            </span>
            <span className={`${saMono} mt-1 block text-[11px] text-slate-500`}>
              Unlocks resume generation for this account.
            </span>
          </span>
        </label>
        <SectionFooter
          busy={savingSection === "access"}
          label="Save access"
          onSave={() => void saveAccess()}
        />
      </Section>

      {/* Crawl */}
      <Section title="Job crawl settings" description="Listing URLs and country filters.">
        <div className="space-y-4">
          {ALL_JOB_CRAWL_PLATFORMS.map((platform) => {
            const countryOnly = !isJobCrawlUrlPlatform(platform);
            return (
              <div key={platform}>
                <label htmlFor={`sa-listing-${platform}`} className={saLabel}>
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
                  disabled={busy}
                  spellCheck={false}
                />
                <p className={`${saMono} mt-1.5 text-[11px] text-slate-500`}>
                  {JOB_CRAWL_PLATFORM_HINT[platform]}
                </p>
              </div>
            );
          })}
        </div>
        <SectionFooter
          busy={savingSection === "crawl"}
          label="Save crawl settings"
          onSave={() => void saveCrawl()}
        />
      </Section>

      {/* Template */}
      <Section
        title="Resume template"
        description="Upload a .docx template and preview the stored file."
      >
        {resumeTemplateFileName ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className={`${saMono} text-xs text-emerald-700`}>
              Current: {resumeTemplateFileName}
            </p>
            {canPreviewTemplate ? (
              <ResumeTemplatePreviewButton
                fileName={resumeTemplateFile?.name || resumeTemplateFileName}
                templateFile={resumeTemplateFile}
                templateBase64={resumeTemplateFile ? undefined : templateBase64}
                templateId={resumeTemplateFile ? undefined : templateId}
                fetchPdf={
                  resumeTemplateFile
                    ? undefined
                    : () => fetchAdminTemplatePdf()
                }
                size="sm"
              />
            ) : null}
          </div>
        ) : (
          <p className={`${saMono} text-[11px] text-slate-400`}>No template on file yet.</p>
        )}
        <ProfileFileUpload
          id="sa-resume-template"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          label="Upload resume template"
          hint=".docx only · max 10 MB · save this section after selecting a file"
          fileName={resumeTemplateFile?.name}
          uploading={uploading}
          disabled={busy}
          onFile={handleResumeTemplateFile}
        />
        <SectionFooter
          busy={savingSection === "template"}
          label="Save template"
          onSave={() => void saveTemplate()}
        />
      </Section>

      {/* Prompt */}
      <Section
        title="Writing prompt"
        description="Edit the prompt text directly, or replace it with a file upload."
      >
        <ProfileFileUpload
          id="sa-prompt-file"
          accept=".txt,.md,.json,text/plain,text/markdown,application/json"
          label="Replace prompt file"
          hint=".txt, .md, or .json · uploads immediately"
          fileName={pendingPromptName || undefined}
          uploading={uploading}
          disabled={busy}
          onFile={handlePromptFile}
        />
        <p className={`${saMono} text-[11px] text-slate-500`}>
          {promptFileName ? `Stored prompt · ${promptFileName}` : "No prompt file name on profile."}
        </p>
        <div>
          <label htmlFor="sa-prompt-text" className={saLabel}>
            Prompt text
          </label>
          <textarea
            id="sa-prompt-text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={14}
            disabled={busy}
            spellCheck={false}
            className={`${fieldClass} mt-1 min-h-[220px] resize-y font-[family-name:var(--font-sa-mono)] text-[12px] leading-relaxed`}
            placeholder="Writing prompt used for resume generation…"
          />
        </div>
        <SectionFooter
          busy={savingSection === "prompt"}
          label="Save prompt"
          onSave={() => void savePrompt()}
        />
      </Section>

      {/* Danger */}
      <Section
        title="Delete profile"
        description="Permanently removes this account and its stored profile assets. This cannot be undone."
      >
        <label htmlFor="sa-delete-confirm" className={saLabel}>
          Type the account email to confirm
        </label>
        <input
          id="sa-delete-confirm"
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          className={fieldClass}
          placeholder={user.email}
          disabled={busy}
          spellCheck={false}
          autoComplete="off"
        />
        <SectionFooter
          busy={savingSection === "danger"}
          label="Delete profile"
          busyLabel="Deleting…"
          onSave={() => void deleteProfile()}
          tone="danger"
        />
      </Section>

      {!embedded ? (
        <div>
          <Link href={`${AUTH_LINKS.superAdmin}/profiles`} className={saBtnGhost}>
            ← Profiles
          </Link>
        </div>
      ) : null}
    </div>
  );
}
