import { loadStoredProfile } from "@/lib/user-profile";
import type { User } from "@/types/auth";

const ONBOARDING_PREFIX = "devora21-onboarding-complete:";

function onboardingKey(userId: string): string {
  return `${ONBOARDING_PREFIX}${userId}`;
}

export function isOnboardingComplete(userId: string | undefined): boolean {
  if (!userId || typeof window === "undefined") return false;
  try {
    return localStorage.getItem(onboardingKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingComplete(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(onboardingKey(userId), "1");
  } catch {
    // ignore
  }
}

/** True when verified user should see the onboarding wizard before the app. */
export function needsOnboarding(user: User | null | undefined): boolean {
  if (!user?.id) return false;
  if (isOnboardingComplete(user.id)) return false;

  const stored = loadStoredProfile(user.id);
  const hasName = Boolean(
    stored.firstName?.trim() || user.firstName?.trim(),
  ) && Boolean(stored.lastName?.trim() || user.lastName?.trim());
  const hasAvatar = Boolean(stored.avatarUrl?.trim() || user.avatar?.trim());

  if (hasName && hasAvatar) {
    markOnboardingComplete(user.id);
    return false;
  }

  return true;
}

export const ONBOARDING_STEPS = [
  { id: "profile", title: "Your name", subtitle: "How should we address you?" },
  { id: "avatar", title: "Profile photo", subtitle: "Upload a photo or use a link" },
  { id: "resume", title: "Resume defaults", subtitle: "Pick a starting template" },
  { id: "finish", title: "All set", subtitle: "Your account is ready" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];
