"use client";

import { useCallback, useEffect, useState } from "react";
import { profileApi, type UserPromptAsset, type UserResumeTemplateAsset } from "@/lib/profile-api";
import { resumeBuilderAccessDeniedMessage } from "@/lib/resume-access";
import { loadStoredProfile, saveStoredProfile } from "@/lib/user-profile";

export function useUserProfileAssets(userId: string | undefined) {
  const [template, setTemplate] = useState<UserResumeTemplateAsset | null>(null);
  const [prompt, setPrompt] = useState<UserPromptAsset | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState("");

  const hydrateFromLocal = useCallback(() => {
    if (!userId) return;
    const stored = loadStoredProfile(userId);
    if (stored.resumeTemplateFileName && stored.resumeTemplateBase64) {
      setTemplate({
        fileName: stored.resumeTemplateFileName,
        templateBase64: stored.resumeTemplateBase64,
      });
    }
    if (stored.customPrompt) {
      setPrompt({
        content: stored.customPrompt,
        fileName: stored.promptFileName,
      });
    }
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
    hydrateFromLocal();

    let templateLoaded = false;
    let promptLoaded = false;

    try {
      const remoteTemplate = await profileApi.fetchResumeTemplate().catch((err) => {
        if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 403) {
          throw err;
        }
        return null;
      });
      if (remoteTemplate) {
        setTemplate(remoteTemplate);
        saveStoredProfile(userId, {
          resumeTemplateFileName: remoteTemplate.fileName,
          resumeTemplateBase64: remoteTemplate.templateBase64,
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
    }

    setLoading(false);
  }, [userId, hydrateFromLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { template, prompt, loading, error, refresh, setTemplate, setPrompt };
}
