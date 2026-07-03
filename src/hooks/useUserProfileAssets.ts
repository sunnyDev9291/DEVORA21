"use client";

import { useCallback, useEffect, useState } from "react";
import { profileApi, type UserPromptAsset, type UserResumeTemplateAsset } from "@/lib/profile-api";
import { resumeBuilderAccessDeniedMessage } from "@/lib/resume-access";
import {
  fingerprintTemplateBase64,
  PROFILE_TEMPLATE_UPDATED_EVENT,
} from "@/lib/template-fingerprint";
import { loadStoredProfile, saveStoredProfile } from "@/lib/user-profile";

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

    const stored = userId ? loadStoredProfile(userId) : null;
    const localTemplate =
      stored?.resumeTemplateFileName && stored.resumeTemplateBase64
        ? {
            fileName: stored.resumeTemplateFileName,
            templateBase64: stored.resumeTemplateBase64,
          }
        : null;
    if (localTemplate) {
      setTemplate(localTemplate);
    }
    if (stored?.customPrompt) {
      setPrompt({
        content: stored.customPrompt,
        fileName: stored.promptFileName,
      });
    }

    let templateLoaded = Boolean(localTemplate);
    let promptLoaded = Boolean(stored?.customPrompt);

    try {
      const remoteTemplate = await profileApi.fetchResumeTemplate().catch((err) => {
        if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 403) {
          throw err;
        }
        return null;
      });
      if (remoteTemplate) {
        const localFingerprint = fingerprintTemplateBase64(localTemplate?.templateBase64);
        const remoteFingerprint = fingerprintTemplateBase64(remoteTemplate.templateBase64);
        const localIsNewerUpload = Boolean(
          stored?.resumeTemplateUpdatedAt &&
            localFingerprint &&
            localFingerprint !== remoteFingerprint
        );

        if (localIsNewerUpload && localTemplate) {
          setTemplate(localTemplate);
        } else {
          setTemplate(remoteTemplate);
          saveStoredProfile(userId, {
            resumeTemplateFileName: remoteTemplate.fileName,
            resumeTemplateBase64: remoteTemplate.templateBase64,
            resumeTemplateUpdatedAt: undefined,
          });
        }
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
      if (stored?.customPrompt) {
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
