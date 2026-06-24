"use client";



import Link from "next/link";

import { useEffect, useRef, useState } from "react";

import ProfileFileUpload from "@/components/profile/ProfileFileUpload";

import UserAvatar from "@/components/ui/UserAvatar";

import Button from "@/components/ui/Button";

import { processAvatarFile } from "@/lib/avatar-image";

import { authApi, getApiErrorMessage } from "@/lib/auth-api";

import { APP_FEATURES } from "@/lib/constants";

import { readPromptFile, validateDocxFile } from "@/lib/profile-file";

import {

  cacheUploadedPrompt,

  cacheUploadedTemplate,

  loadStoredProfile,

  resolveAvatarUrl,

  resolveUserNames,

  saveStoredProfile,

} from "@/lib/user-profile";

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

  const avatarInputRef = useRef<HTMLInputElement>(null);



  const [firstName, setFirstName] = useState(resolved.firstName);

  const [lastName, setLastName] = useState(resolved.lastName);

  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(resolveAvatarUrl(user, stored) ?? "");

  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [resumeTemplateFile, setResumeTemplateFile] = useState<File | null>(null);

  const [resumeTemplateFileName, setResumeTemplateFileName] = useState(

    stored.resumeTemplateFileName || user.resumeTemplateFileName || "",

  );

  const [promptFile, setPromptFile] = useState<File | null>(null);

  const [customPrompt, setCustomPrompt] = useState(stored.customPrompt);

  const [promptFileName, setPromptFileName] = useState(stored.promptFileName || user.promptFileName || "");

  const [uploading, setUploading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");



  useEffect(() => {

    const nextStored = loadStoredProfile(user.id);

    const names = resolveUserNames(user, nextStored);

    setFirstName(names.firstName);

    setLastName(names.lastName);

    setAvatarPreviewUrl(resolveAvatarUrl(user, nextStored) ?? "");

    setResumeTemplateFileName(nextStored.resumeTemplateFileName || user.resumeTemplateFileName || "");

    setCustomPrompt(nextStored.customPrompt);

    setPromptFileName(nextStored.promptFileName || user.promptFileName || "");

  }, [user]);



  async function handleAvatarFile(file: File) {

    setError("");

    setUploading(true);

    try {

      const { dataUrl } = await processAvatarFile(file);

      setAvatarFile(file);

      setAvatarPreviewUrl(dataUrl);

    } catch (err) {

      setError((err as Error).message || "Could not upload image.");

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

    setError("");

    setUploading(true);

    try {

      const content = await readPromptFile(file);

      setPromptFile(file);

      setPromptFileName(file.name);

      setCustomPrompt(content);

    } catch (err) {

      setError((err as Error).message || "Could not read prompt file.");

    } finally {

      setUploading(false);

    }

  }



  async function handleSave(e: React.FormEvent) {

    e.preventDefault();

    setSaving(true);

    setError("");

    setMessage("");



    const payload = {

      firstName: firstName.trim(),

      lastName: lastName.trim(),

      avatarFile,

      avatarDataUrl: avatarPreviewUrl,

      resumeTemplateFile,

      promptFile,

      customPrompt,

    };



    saveStoredProfile(user.id, {

      firstName: payload.firstName,

      lastName: payload.lastName,

      avatarUrl: avatarPreviewUrl,

      customPrompt,

      promptFileName: promptFile?.name || promptFileName,

    });



    try {

      await authApi.updateProfileWithFiles(payload);



      if (resumeTemplateFile) {

        await cacheUploadedTemplate(user.id, resumeTemplateFile);

      }

      if (promptFile && customPrompt.trim()) {

        await cacheUploadedPrompt(user.id, promptFile, customPrompt.trim());

      }



      onProfileUpdated?.();

      setMessage("Profile saved.");

      setAvatarFile(null);

      setResumeTemplateFile(null);

      setPromptFile(null);

    } catch (err) {

      const status = err instanceof Error && "status" in err ? (err as { status: number }).status : 0;

      if (status === 404 || status === 405 || status === 501) {

        if (resumeTemplateFile) await cacheUploadedTemplate(user.id, resumeTemplateFile);

        if (promptFile && customPrompt.trim()) {

          await cacheUploadedPrompt(user.id, promptFile, customPrompt.trim());

        }

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

          <Button

            type="button"

            variant="outline"

            disabled={uploading || saving}

            onClick={() => avatarInputRef.current?.click()}

          >

            {uploading ? "Uploading…" : "Change photo"}

          </Button>

        </div>

        <div className="min-w-0 flex-1">

          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Your profile</h2>

          <p className="mt-1 text-sm text-slate-400">

            Your avatar, resume template, and prompt are private to your account.

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

      </div>



      <div className="mt-8 border-t border-white/10 pt-8">

        <h3 className="mb-1 text-sm font-semibold text-white">Resume template</h3>

        <p className="mb-4 text-xs text-slate-500">

          Upload your own .docx template. The resume builder uses this file — not shared frontend templates.

        </p>

        {resumeTemplateFileName && (

          <p className="mb-3 text-xs text-emerald-300">Current: {resumeTemplateFileName}</p>

        )}

        <ProfileFileUpload

          id="dashboard-resume-template"

          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

          label="Upload resume template"

          hint=".docx only · max 10 MB"

          fileName={resumeTemplateFile?.name}

          uploading={uploading}

          disabled={saving}

          onFile={handleResumeTemplateFile}

        />

      </div>



      <div className="mt-8 border-t border-white/10 pt-8">

        <h3 className="mb-1 text-sm font-semibold text-white">Writing prompt</h3>

        <p className="mb-4 text-xs text-slate-500">

          Upload a private prompt file. Its contents are never shown in the app — only used when generating resumes.

        </p>

        <ProfileFileUpload

          id="dashboard-prompt-file"

          accept=".txt,.md,.json,text/plain,text/markdown,application/json"

          label="Replace prompt file"

          hint=".txt, .md, or .json with a content field"

          uploading={uploading}

          disabled={saving}

          onFile={handlePromptFile}

        />

        <p className="mt-3 text-xs text-slate-500">

          {customPrompt || promptFileName ? "Private prompt configured." : "No prompt uploaded yet."}

        </p>

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

        <Button type="submit" disabled={saving || uploading}>

          {saving ? "Saving…" : "Save profile"}

        </Button>

        <Link

          href={APP_FEATURES.resume.href}

          className="inline-flex items-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.05]"

        >

          Open resume builder

        </Link>

      </div>

    </form>

  );

}


