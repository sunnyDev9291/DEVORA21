import { profileApi, type UserPromptAsset } from "@/lib/profile-api";
import { loadStoredProfile, saveStoredProfile } from "@/lib/user-profile";
import { PROFILE_PROMPT_UPDATED_EVENT } from "@/lib/template-fingerprint";

const LOCAL_PROMPT_PREFER_MS = 7 * 24 * 60 * 60 * 1000;

function dispatchPromptUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PROFILE_PROMPT_UPDATED_EVENT));
  }
}

/** Persist prompt text locally as the source of truth after a user upload. */
export function cacheLocalWritingPrompt(
  userId: string,
  content: string,
  fileName?: string
): void {
  const trimmed = content.trim();
  if (!trimmed) return;
  saveStoredProfile(userId, {
    customPrompt: trimmed,
    promptFileName: fileName,
    promptUpdatedAt: Date.now(),
  });
  dispatchPromptUpdated();
}

/**
 * Resolve the writing prompt for generation.
 * Prefer a recently uploaded LOCAL copy when the profile API still returns a stale prompt.
 */
export async function resolveWritingPrompt(
  userId: string | undefined,
  fallback = ""
): Promise<{ content: string; fileName?: string; source: "local" | "remote" | "fallback" }> {
  const local = userId ? loadStoredProfile(userId) : null;
  const localContent = local?.customPrompt?.trim() ?? "";
  const localUpdatedAt =
    typeof local?.promptUpdatedAt === "number" ? local.promptUpdatedAt : 0;
  const localIsFresh =
    Boolean(localContent) &&
    localUpdatedAt > 0 &&
    Date.now() - localUpdatedAt < LOCAL_PROMPT_PREFER_MS;

  let remote: UserPromptAsset | null = null;
  try {
    remote = await profileApi.fetchPrompt();
  } catch {
    remote = null;
  }

  const remoteContent = remote?.content?.trim() ?? "";

  // User just uploaded a new file — server GET may still return the old prompt.
  if (localIsFresh && localContent && localContent !== remoteContent) {
    return {
      content: localContent,
      fileName: local?.promptFileName,
      source: "local",
    };
  }

  if (remoteContent) {
    if (userId && remoteContent !== localContent) {
      saveStoredProfile(userId, {
        customPrompt: remoteContent,
        promptFileName: remote?.fileName,
        promptUpdatedAt: undefined,
      });
      dispatchPromptUpdated();
    }
    return {
      content: remoteContent,
      fileName: remote?.fileName,
      source: "remote",
    };
  }

  if (localContent) {
    return {
      content: localContent,
      fileName: local?.promptFileName,
      source: "local",
    };
  }

  const trimmedFallback = fallback.trim();
  return {
    content: trimmedFallback,
    source: "fallback",
  };
}
