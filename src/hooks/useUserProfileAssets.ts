"use client";

import { useCallback, useEffect, useState } from "react";
import { profileApi, type UserPromptAsset, type UserResumeTemplateAsset } from "@/lib/profile-api";
import { resumeBuilderAccessDeniedMessage } from "@/lib/resume-access";
import { PROFILE_TEMPLATE_UPDATED_EVENT } from "@/lib/template-fingerprint";
import { loadStoredProfile, saveStoredProfile } from "@/lib/user-profile";

/**
 * Profile template/prompt are stored on the backend and mirrored in localStorage.
 * Remote is always the source of truth when available so another device/session
 * that uploads a new template or prompt is picked up here.
 * LocalStorage is only an instant hydrate + offline fallback.
 */
export function useUserProfileAssets(userId: string | undefined) {
  const [template, setTemplate] = useState<UserResumeTemplateAsset | null>(null);
  const [prompt, setPrompt] = useState<UserPromptAsset | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState("");

  const hydrateFromLocal = useCallback(() => {
    if (!userId) return null;
    const stored = loadStoredProfile(userId);
    if (stored.resumeTemplateFileName && stored.resumeTemplateBase64) {
      const next = {
        fileName: stored.resumeTemplateFileName,
        templateBase64: stored.resumeTemplateBase64,
      };
      setTemplate(next);
      return next;
    }
    return null;
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setTemplate(null);
      setPrompt(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const stored = loadStoredProfile(userId);
    const localTemplate =
      stored.resumeTemplateFileName && stored.resumeTemplateBase64
        ? {
            fileName: stored.resumeTemplateFileName,
            templateBase64: stored.resumeTemplateBase64,
          }
        : null;

    // Instant UI from local mirror; remote overwrite follows.
    if (localTemplate) {
      setTemplate(localTemplate);
    }
    if (stored.customPrompt) {
      setPrompt({
        content: stored.customPrompt,
        fileName: stored.promptFileName,
      });
    }

    let templateLoaded = Boolean(localTemplate);
    let promptLoaded = Boolean(stored.customPrompt);

    try {
      const remoteTemplate = await profileApi.fetchResumeTemplate().catch((err) => {
        if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 403) {
          throw err;
        }
        return null;
      });
      if (remoteTemplate) {
        // Backend wins — another device may have uploaded a newer file.
        setTemplate(remoteTemplate);
        saveStoredProfile(userId, {
          resumeTemplateFileName: remoteTemplate.fileName,
          resumeTemplateBase64: remoteTemplate.templateBase64,
          resumeTemplateUpdatedAt: undefined,
        });
        templateLoaded = true;
      }
    } catch (err) {
      setError(resumeBuilderAccessDeniedMessage(err));
    }

    try {
      const remotePrompt = await profileApi.fetchPrompt().catch(() => null);
      if (remotePrompt) {
        setPrompt(remotePrompt);
        saveStoredProfile(userId, {
          customPrompt: remotePrompt.content,
          promptFileName: remotePrompt.fileName,
        });
        promptLoaded = true;
      }
    } catch (err) {
      setError((err as Error).message || "Could not load writing prompt.");
    }

    if (!templateLoaded && !promptLoaded) {
      hydrateFromLocal();
      if (stored.customPrompt) {
        setPrompt({
          content: stored.customPrompt,
          fileName: stored.promptFileName,
        });
      }
    }

    setLoading(false);
  }, [userId, hydrateFromLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-fetch when the user returns to this tab/window so uploads from another
  // device are adopted without a full page reload.
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, refresh]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    const syncTemplateFromStorage = () => {
      hydrateFromLocal();
    };

    window.addEventListener(PROFILE_TEMPLATE_UPDATED_EVENT, syncTemplateFromStorage);
    window.addEventListener("storage", syncTemplateFromStorage);
    return () => {
      window.removeEventListener(PROFILE_TEMPLATE_UPDATED_EVENT, syncTemplateFromStorage);
      window.removeEventListener("storage", syncTemplateFromStorage);
    };
  }, [userId, hydrateFromLocal]);

  return { template, prompt, loading, error, refresh, setTemplate, setPrompt };
}
