import type { User } from "@/types/auth";

const ONBOARDING_PREFIX = "devora21-onboarding-complete:";

function onboardingKey(userId: string): string {
  return `${ONBOARDING_PREFIX}${userId}`;
}

export function isOnboardingCompleteLocal(userId: string | undefined): boolean {
  if (!userId || typeof window === "undefined") return false;
  try {
    return localStorage.getItem(onboardingKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingCompleteLocal(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(onboardingKey(userId), "1");
  } catch {
    // ignore
  }
}

/** True when verified user must complete the onboarding dialog before the app. */
export function needsOnboarding(user: User | null | undefined): boolean {
  if (!user?.id) return false;
  if (user.onboardingCompleted === true) return false;
  if (isOnboardingCompleteLocal(user.id)) return false;
  return true;
}

/** LinkedIn-style one board per step; backend save happens only after the last step. */
export const ONBOARDING_STEPS = [
  {
    id: "profile",
    title: "What's your name?",
    subtitle: "This is how you'll appear on Devora21.",
  },
  {
    id: "avatar",
    title: "Add a profile photo",
    subtitle: "This photo becomes your profile avatar across Devora21.",
  },
  {
    id: "resume",
    title: "Upload your resume template",
    subtitle: "Upload a .docx file — your personal template, not a shared catalog.",
  },
  {
    id: "prompt",
    title: "Upload your writing prompt",
    subtitle: "Upload a prompt file only you can access when generating resumes.",
  },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

export type OnboardingDraft = {
  firstName: string;
  lastName: string;
  avatarUrl: string;
};

export function buildInitialDraft(user: User): OnboardingDraft {
  const firstName = user.firstName?.trim() ?? "";
  const lastName = user.lastName?.trim() ?? "";
  return {
    firstName,
    lastName,
    avatarUrl: user.avatar?.trim() ?? "",
  };
}
