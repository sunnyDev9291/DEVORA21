"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TemplatePicker from "@/components/sections/TemplatePicker";
import UserAvatar from "@/components/ui/UserAvatar";
import Button from "@/components/ui/Button";
import OnboardingStepProgress from "@/components/onboarding/OnboardingStepProgress";
import { useAuth } from "@/context/AuthContext";
import { processAvatarFile } from "@/lib/avatar-image";
import { authApi, getApiErrorMessage } from "@/lib/auth-api";
import {
  markOnboardingComplete,
  ONBOARDING_STEPS,
  type OnboardingStepId,
} from "@/lib/onboarding";
import { AUTH_LINKS } from "@/lib/constants";
import {
  loadStoredProfile,
  resolveAvatarUrl,
  resolveUserNames,
  saveStoredProfile,
} from "@/lib/user-profile";
import type { ResumeTemplate } from "@/lib/resume-template";
import type { User } from "@/types/auth";

const fieldClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40";

interface OnboardingWizardProps {
  user: User;
}

export default function OnboardingWizard({ user }: OnboardingWizardProps) {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stored = loadStoredProfile(user.id);
  const names = resolveUserNames(user, stored);

  const [step, setStep] = useState<OnboardingStepId>("profile");
  const [firstName, setFirstName] = useState(names.firstName);
  const [lastName, setLastName] = useState(names.lastName);
  const [avatarUrl, setAvatarUrl] = useState(resolveAvatarUrl(user, stored) ?? "");
  const [resumeTemplate, setResumeTemplate] = useState<ResumeTemplate | null>(stored.resumeTemplate);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === step);
  const stepMeta = ONBOARDING_STEPS[stepIndex];

  useEffect(() => {
    const next = resolveUserNames(user, loadStoredProfile(user.id));
    setFirstName(next.firstName);
    setLastName(next.lastName);
    setAvatarUrl(resolveAvatarUrl(user, loadStoredProfile(user.id)) ?? "");
  }, [user]);

  const persistLocal = useCallback(
    (patch: Parameters<typeof saveStoredProfile>[1]) => {
      saveStoredProfile(user.id, patch);
    },
    [user.id],
  );

  async function handleAvatarFile(file: File) {
    setError("");
    setUploading(true);
    try {
      const { dataUrl } = await processAvatarFile(file);
      setAvatarUrl(dataUrl);
      persistLocal({ avatarUrl: dataUrl });
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
      persistLocal({ firstName: firstName.trim(), lastName: lastName.trim() });
      setStep("avatar");
      return;
    }
    if (step === "avatar") {
      persistLocal({ avatarUrl: avatarUrl.trim() });
      setStep("resume");
      return;
    }
    if (step === "resume") {
      setStep("finish");
    }
  }

  function goBack() {
    setError("");
    const prev = ONBOARDING_STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  }

  async function handleFinish() {
    setSaving(true);
    setError("");

    const profilePatch = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      avatarUrl: avatarUrl.trim(),
      resumeTemplate,
    };

    persistLocal(profilePatch);

    try {
      await authApi.updateProfile({
        firstName: profilePatch.firstName,
        lastName: profilePatch.lastName,
        avatar: profilePatch.avatarUrl || undefined,
        resumeTemplateName: resumeTemplate?.name,
      });
    } catch (err) {
      const status = err instanceof Error && "status" in err ? (err as { status: number }).status : 0;
      if (status !== 404 && status !== 405 && status !== 501) {
        setError(getApiErrorMessage(err, "Could not save profile."));
        setSaving(false);
        return;
      }
    }

    markOnboardingComplete(user.id);
    await refreshUser();
    router.replace(AUTH_LINKS.dashboard);
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <OnboardingStepProgress currentStep={step} />

      <div className="rounded-2xl border border-white/10 bg-navy-900/80 p-6 sm:p-8 shadow-2xl shadow-black/40">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
            Step {stepIndex + 1} of {ONBOARDING_STEPS.length}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">{stepMeta.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{stepMeta.subtitle}</p>
        </div>

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
                onChange={(e) => {
                  setAvatarUrl(e.target.value);
                  persistLocal({ avatarUrl: e.target.value });
                }}
                placeholder="https://…"
                className={fieldClass}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setAvatarUrl("");
                persistLocal({ avatarUrl: "" });
                setStep("resume");
              }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300"
            >
              Skip for now
            </button>
          </div>
        )}

        {step === "resume" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Choose a default resume template. You can change this anytime on your dashboard or in the resume builder.
            </p>
            <TemplatePicker selected={resumeTemplate} onSelect={(t) => {
              setResumeTemplate(t);
              persistLocal({ resumeTemplate: t });
            }} />
            <button
              type="button"
              onClick={() => setStep("finish")}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300"
            >
              Skip for now
            </button>
          </div>
        )}

        {step === "finish" && (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex justify-center">
              <UserAvatar
                firstName={firstName}
                lastName={lastName}
                email={user.email}
                avatarUrl={avatarUrl}
                size="lg"
                className="!h-24 !w-24"
              />
            </div>
            <p className="text-lg font-semibold text-white">
              Welcome, {firstName}!
            </p>
            <p className="text-sm text-slate-400">
              Your profile is ready. Head to the dashboard to open the resume builder and other tools.
            </p>
            {resumeTemplate && (
              <p className="text-xs text-slate-500">
                Default template: <span className="text-slate-300">{resumeTemplate.name}</span>
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
            {error}
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {stepIndex > 0 && step !== "finish" && (
            <Button type="button" variant="outline" onClick={goBack}>
              Back
            </Button>
          )}
          {step !== "finish" ? (
            <Button type="button" className="flex-1" onClick={goNext}>
              Continue
            </Button>
          ) : (
            <Button type="button" className="flex-1" disabled={saving} onClick={() => void handleFinish()}>
              {saving ? "Saving…" : "Go to dashboard"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
