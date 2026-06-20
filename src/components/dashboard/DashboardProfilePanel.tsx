"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SavedPromptPicker from "@/components/ui/SavedPromptPicker";
import MarkdownBoldTextarea from "@/components/ui/MarkdownBoldTextarea";
import TemplatePicker from "@/components/sections/TemplatePicker";
import UserAvatar from "@/components/ui/UserAvatar";
import Button from "@/components/ui/Button";
import type { ResumePromptOption } from "@/lib/resume-prompt-option";
import type { ResumeTemplate } from "@/lib/resume-template";
import { authApi, getApiErrorMessage } from "@/lib/auth-api";
import {
  loadStoredProfile,
  resolveAvatarUrl,
  resolveUserNames,
  saveStoredProfile,
} from "@/lib/user-profile";
import { APP_FEATURES } from "@/lib/constants";
import type { User } from "@/types/auth";

const fieldClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40";

interface DashboardProfilePanelProps {
  user: User;
  onProfileUpdated?: () => void;
}

export default function DashboardProfilePanel({ user, onProfileUpdated }: DashboardProfilePanelProps) {
  const stored = loadStoredProfile(user.id);
  const resolved = resolveUserNames(user, stored);

  const [firstName, setFirstName] = useState(resolved.firstName);
  const [lastName, setLastName] = useState(resolved.lastName);
  const [avatarUrl, setAvatarUrl] = useState(resolveAvatarUrl(user, stored) ?? "");
  const [resumeTemplate, setResumeTemplate] = useState<ResumeTemplate | null>(stored.resumeTemplate);
  const [customPrompt, setCustomPrompt] = useState(stored.customPrompt);
  const [selectedPromptId, setSelectedPromptId] = useState(stored.selectedPromptId);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const nextStored = loadStoredProfile(user.id);
    const names = resolveUserNames(user, nextStored);
    setFirstName(names.firstName);
    setLastName(names.lastName);
    setAvatarUrl(resolveAvatarUrl(user, nextStored) ?? "");
    setResumeTemplate(nextStored.resumeTemplate);
    setCustomPrompt(nextStored.customPrompt);
    setSelectedPromptId(nextStored.selectedPromptId);
  }, [user]);

  const persistLocal = useCallback(
    (patch: Parameters<typeof saveStoredProfile>[1]) => {
      saveStoredProfile(user.id, patch);
    },
    [user.id]
  );

  async function handlePromptSelect(promptId: string, prompt?: ResumePromptOption) {
    setSelectedPromptId(promptId);
    persistLocal({ selectedPromptId: promptId });

    if (!promptId) {
      setCustomPrompt("");
      persistLocal({ customPrompt: "", selectedPromptId: "" });
      return;
    }

    if (!prompt) return;

    setLoadingPrompt(true);
    setError("");
    try {
      const res = await fetch(prompt.file, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed to load prompt (${res.status}).`);
      const content = String(data.content ?? "");
      setCustomPrompt(content);
      persistLocal({ customPrompt: content, selectedPromptId: promptId });
    } catch (err) {
      setError((err as Error).message || "Could not load the selected prompt.");
    } finally {
      setLoadingPrompt(false);
    }
  }

  function handleTemplateSelect(template: ResumeTemplate) {
    setResumeTemplate(template);
    persistLocal({ resumeTemplate: template });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const profilePatch = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      avatarUrl: avatarUrl.trim(),
      resumeTemplate,
      customPrompt,
      selectedPromptId,
    };

    persistLocal(profilePatch);

    try {
      await authApi.updateProfile({
        firstName: profilePatch.firstName,
        lastName: profilePatch.lastName,
        avatar: profilePatch.avatarUrl || undefined,
        resumeTemplateName: resumeTemplate?.name,
        customPrompt,
      });

      await authApi.getMe();
      onProfileUpdated?.();
      setMessage("Profile saved.");
    } catch (err) {
      const status = err instanceof Error && "status" in err ? (err as { status: number }).status : 0;
      if (status === 404 || status === 405 || status === 501) {
        onProfileUpdated?.();
        setMessage("Saved on this device. (Backend profile API not available yet.)");
      } else {
        setError(getApiErrorMessage(err, "Could not save profile."));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="rounded-2xl border border-white/10 bg-navy-900/60 p-6 sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <UserAvatar
          firstName={firstName}
          lastName={lastName}
          email={user.email}
          avatarUrl={avatarUrl || user.avatar}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Your profile</h2>
          <p className="mt-1 text-sm text-slate-400">
            Name, avatar, resume template, and writing prompt used across the resume builder.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="mb-1.5 block text-xs font-medium text-slate-400">
            First name
          </label>
          <input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={fieldClass}
            autoComplete="given-name"
          />
        </div>
        <div>
          <label htmlFor="lastName" className="mb-1.5 block text-xs font-medium text-slate-400">
            Last name
          </label>
          <input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={fieldClass}
            autoComplete="family-name"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-slate-400">
            Email
          </label>
          <input id="email" value={user.email} readOnly className={`${fieldClass} opacity-70 cursor-not-allowed`} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="avatarUrl" className="mb-1.5 block text-xs font-medium text-slate-400">
            Avatar URL
          </label>
          <input
            id="avatarUrl"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="Google photo URL or leave empty for generated avatar"
            className={fieldClass}
          />
          <p className="mt-1.5 text-[11px] text-slate-500">
            Google sign-in may fill this automatically when the backend returns an avatar.
          </p>
        </div>
      </div>

      <div className="mt-8 border-t border-white/10 pt-8">
        <h3 className="text-sm font-semibold text-white mb-1">Resume template</h3>
        <p className="text-xs text-slate-500 mb-4">
          Default template for new resumes. Also editable on the{" "}
          <Link href={APP_FEATURES.resume.href} className="text-blue-400 hover:text-blue-300">
            resume builder
          </Link>
          .
        </p>
        <TemplatePicker selected={resumeTemplate} onSelect={handleTemplateSelect} />
      </div>

      <div className="mt-8 border-t border-white/10 pt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Your prompt</h3>
            <p className="text-xs text-slate-500 mt-1">Extra instructions applied when generating resumes.</p>
          </div>
          <SavedPromptPicker
            selectedId={selectedPromptId}
            loading={loadingPrompt}
            onSelect={handlePromptSelect}
          />
        </div>
        <MarkdownBoldTextarea
          id="dashboardCustomPrompt"
          value={customPrompt}
          onChange={(value) => {
            setSelectedPromptId("");
            setCustomPrompt(value);
            persistLocal({ customPrompt: value, selectedPromptId: "" });
          }}
          rows={10}
          placeholder="Paste or edit your resume writing rules…"
          className="min-h-[220px]"
        />
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200" role="status">
          {message}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
        <Link
          href={APP_FEATURES.resume.href}
          className="inline-flex items-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.05] transition-colors"
        >
          Open resume builder
        </Link>
      </div>
    </form>
  );
}
