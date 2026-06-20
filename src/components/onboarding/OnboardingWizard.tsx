"use client";



import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import OnboardingDialog from "@/components/onboarding/OnboardingDialog";

import OnboardingStepProgress from "@/components/onboarding/OnboardingStepProgress";

import TemplatePicker from "@/components/sections/TemplatePicker";

import Button from "@/components/ui/Button";

import MarkdownBoldTextarea from "@/components/ui/MarkdownBoldTextarea";

import SavedPromptPicker from "@/components/ui/SavedPromptPicker";

import UserAvatar from "@/components/ui/UserAvatar";

import { useAuth } from "@/context/AuthContext";

import { processAvatarFile } from "@/lib/avatar-image";

import { authApi, getApiErrorMessage } from "@/lib/auth-api";

import { AUTH_LINKS } from "@/lib/constants";

import {

  buildInitialDraft,

  markOnboardingCompleteLocal,

  ONBOARDING_STEPS,

  type OnboardingStepId,

} from "@/lib/onboarding";

import { saveStoredProfile } from "@/lib/user-profile";

import type { ResumeTemplate } from "@/lib/resume-template";

import type { User } from "@/types/auth";



const fieldClass =

  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40";



interface OnboardingWizardProps {

  user: User;

}



export default function OnboardingWizard({ user }: OnboardingWizardProps) {

  const router = useRouter();

  const { refreshUser } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);



  const [step, setStep] = useState<OnboardingStepId>("profile");

  const [firstName, setFirstName] = useState("");

  const [lastName, setLastName] = useState("");

  const [avatarUrl, setAvatarUrl] = useState("");

  const [resumeTemplate, setResumeTemplate] = useState<ResumeTemplate | null>(null);

  const [customPrompt, setCustomPrompt] = useState("");

  const [selectedPromptId, setSelectedPromptId] = useState("");

  const [uploading, setUploading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");



  const stepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === step);

  const stepMeta = ONBOARDING_STEPS[stepIndex];

  const isLastStep = step === "prompt";



  useEffect(() => {

    const draft = buildInitialDraft(user);

    setFirstName(draft.firstName);

    setLastName(draft.lastName);

    setAvatarUrl(draft.avatarUrl);

  }, [user]);



  async function handleAvatarFile(file: File) {

    setError("");

    setUploading(true);

    try {

      const { dataUrl } = await processAvatarFile(file);

      setAvatarUrl(dataUrl);

    } catch (err) {

      setError((err as Error).message || "Could not upload image.");

    } finally {

      setUploading(false);

    }

  }



  function goNext() {

    setError("");

    if (step === "profile") {

      if (!firstName.trim() || !lastName.trim()) {

        setError("Please enter your first and last name.");

        return;

      }

      setStep("avatar");

      return;

    }

    if (step === "avatar") {

      setStep("resume");

      return;

    }

    if (step === "resume") {

      setStep("prompt");

    }

  }



  function goBack() {

    setError("");

    const prev = ONBOARDING_STEPS[stepIndex - 1];

    if (prev) setStep(prev.id);

  }



  async function handleComplete() {

    if (!firstName.trim() || !lastName.trim()) {

      setError("Please enter your first and last name.");

      setStep("profile");

      return;

    }



    setSaving(true);

    setError("");



    const payload = {

      firstName: firstName.trim(),

      lastName: lastName.trim(),

      avatar: avatarUrl.trim() || undefined,

      resumeTemplateName: resumeTemplate?.name,

      customPrompt: customPrompt.trim() || undefined,

      selectedPromptId: selectedPromptId.trim() || undefined,

    };



    try {

      await authApi.completeOnboarding(payload);

    } catch (err) {

      const status = err instanceof Error && "status" in err ? (err as { status: number }).status : 0;

      if (status !== 404 && status !== 405 && status !== 501) {

        setError(getApiErrorMessage(err, "Could not save your profile. Please try again."));

        setSaving(false);

        return;

      }

    }



    saveStoredProfile(user.id, {

      firstName: payload.firstName,

      lastName: payload.lastName,

      avatarUrl: avatarUrl.trim(),

      resumeTemplate,

      customPrompt: customPrompt.trim(),

      selectedPromptId: selectedPromptId.trim(),

    });

    markOnboardingCompleteLocal(user.id);

    await refreshUser();

    router.replace(AUTH_LINKS.dashboard);

  }



  function handlePrimaryAction() {

    if (isLastStep) {

      void handleComplete();

    } else {

      goNext();

    }

  }



  return (

    <OnboardingDialog>

      <OnboardingStepProgress currentStep={step} />



      <div className="rounded-2xl border border-white/10 bg-navy-900 shadow-2xl shadow-black/50">

        <div className="border-b border-white/[0.06] px-6 py-5 text-center sm:px-8">

          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">

            Step {stepIndex + 1} of {ONBOARDING_STEPS.length}

          </p>

          <h1 id="onboarding-title" className="mt-2 text-xl font-bold text-white sm:text-2xl">

            {stepMeta.title}

          </h1>

          <p className="mt-1 text-sm text-slate-400">{stepMeta.subtitle}</p>

        </div>



        <div className="px-6 py-6 sm:px-8">

          {step === "profile" && (

            <div className="space-y-4">

              <div>

                <label htmlFor="onb-firstName" className="mb-1.5 block text-xs font-medium text-slate-400">

                  First name

                </label>

                <input

                  id="onb-firstName"

                  value={firstName}

                  onChange={(e) => setFirstName(e.target.value)}

                  className={fieldClass}

                  autoComplete="given-name"

                  autoFocus

                  placeholder="Jane"

                />

              </div>

              <div>

                <label htmlFor="onb-lastName" className="mb-1.5 block text-xs font-medium text-slate-400">

                  Last name

                </label>

                <input

                  id="onb-lastName"

                  value={lastName}

                  onChange={(e) => setLastName(e.target.value)}

                  className={fieldClass}

                  autoComplete="family-name"

                  placeholder="Doe"

                  onKeyDown={(e) => {

                    if (e.key === "Enter") goNext();

                  }}

                />

              </div>

              <p className="text-xs text-slate-500">Signed in as {user.email}</p>

            </div>

          )}



          {step === "avatar" && (

            <div className="space-y-5">

              <div className="flex flex-col items-center gap-4">

                <UserAvatar

                  firstName={firstName}

                  lastName={lastName}

                  email={user.email}

                  avatarUrl={avatarUrl}

                  size="lg"

                  className="!h-28 !w-28 !text-2xl"

                />

                <input

                  ref={fileInputRef}

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

                  disabled={uploading}

                  onClick={() => fileInputRef.current?.click()}

                >

                  {uploading ? "Uploading…" : "Upload photo"}

                </Button>

                <p className="text-center text-[11px] text-slate-500">JPG, PNG, WebP or GIF · max 5 MB</p>

              </div>

              <div>

                <label htmlFor="onb-avatarUrl" className="mb-1.5 block text-xs font-medium text-slate-400">

                  Or paste image URL

                </label>

                <input

                  id="onb-avatarUrl"

                  value={avatarUrl.startsWith("data:") ? "" : avatarUrl}

                  onChange={(e) => setAvatarUrl(e.target.value)}

                  placeholder="https://…"

                  className={fieldClass}

                />

              </div>

            </div>

          )}



          {step === "resume" && (

            <div className="space-y-4">

              <p className="text-sm text-slate-400">

                Pick a default template. You can change this anytime in the resume builder.

              </p>

              <TemplatePicker selected={resumeTemplate} onSelect={setResumeTemplate} />

            </div>

          )}



          {step === "prompt" && (

            <div className="space-y-4">

              <p className="text-sm text-slate-400">

                Optional default instructions for AI resume generation. You can edit this later on your dashboard.

              </p>

              <SavedPromptPicker

                selectedId={selectedPromptId}

                disabled={saving}

                onSelect={(promptId, prompt) => {

                  setSelectedPromptId(promptId);

                  if (prompt?.content) setCustomPrompt(prompt.content);

                }}

              />

              <MarkdownBoldTextarea

                value={customPrompt}

                onChange={(value) => {

                  setCustomPrompt(value);

                  setSelectedPromptId("");

                }}

                placeholder="Describe tone, focus areas, or formatting preferences…"

                rows={6}

              />

            </div>

          )}



          {error && (

            <div

              className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"

              role="alert"

            >

              {error}

            </div>

          )}

        </div>



        <div className="flex flex-col gap-3 border-t border-white/[0.06] px-6 py-5 sm:flex-row sm:px-8">

          {stepIndex > 0 && (

            <Button type="button" variant="outline" disabled={saving} onClick={goBack}>

              Back

            </Button>

          )}

          <Button

            type="button"

            className="flex-1"

            disabled={saving || uploading}

            onClick={handlePrimaryAction}

          >

            {saving ? "Saving…" : isLastStep ? "Finish" : "Continue"}

          </Button>

        </div>



        {(step === "avatar" || step === "resume" || step === "prompt") && !saving && (

          <div className="border-t border-white/[0.04] px-6 pb-5 text-center sm:px-8">

            <button

              type="button"

              onClick={() => {

                if (isLastStep) void handleComplete();

                else goNext();

              }}

              className="text-xs text-slate-500 transition-colors hover:text-slate-300"

            >

              Skip for now

            </button>

          </div>

        )}

      </div>

    </OnboardingDialog>

  );

}


