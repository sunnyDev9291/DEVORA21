"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { profileApi, type UserPromptAsset, type UserResumeTemplateAsset } from "@/lib/profile-api";
import { resumeBuilderAccessDeniedMessage } from "@/lib/resume-access";
import { PROFILE_PROMPT_UPDATED_EVENT, PROFILE_TEMPLATE_UPDATED_EVENT } from "@/lib/template-fingerprint";
import { loadStoredProfile, saveStoredProfile } from "@/lib/user-profile";

function sameTemplate(
  a: UserResumeTemplateAsset | null,
  b: UserResumeTemplateAsset | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.fileName === b.fileName &&
    (a.templateId ?? "") === (b.templateId ?? "") &&
    (a.templateBase64 ?? "") === (b.templateBase64 ?? "")
  );
}

function samePrompt(a: UserPromptAsset | null, b: UserPromptAsset | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.content === b.content && (a.fileName ?? "") === (b.fileName ?? "");
}

function storedToTemplateAsset(stored: ReturnType<typeof loadStoredProfile>): UserResumeTemplateAsset | null {
  if (!stored.resumeTemplateFileName) return null;
  if (!stored.resumeTemplateId && !stored.resumeTemplateBase64) return null;
  return {
    fileName: stored.resumeTemplateFileName,
    templateBase64: stored.resumeTemplateBase64,
    templateId: stored.resumeTemplateId,
  };
}

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
  const templateRef = useRef<UserResumeTemplateAsset | null>(null);
  const promptRef = useRef<UserPromptAsset | null>(null);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    templateRef.current = template;
  }, [template]);

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  const hydrateFromLocal = useCallback(() => {
    if (!userId) return null;
    const next = storedToTemplateAsset(loadStoredProfile(userId));
    if (next && !sameTemplate(templateRef.current, next)) {
      setTemplate(next);
    }
    return next;
  }, [userId]);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);

      if (!userId) {
        setTemplate(null);
        setPrompt(null);
        setLoading(false);
        hasLoadedOnceRef.current = false;
        return;
      }

      // Only block the UI on the first load. Background sync must not remount the form.
      if (!silent && !hasLoadedOnceRef.current) {
        setLoading(true);
      }
      setError("");

      const stored = loadStoredProfile(userId);
      const localTemplate = storedToTemplateAsset(stored);

      if (localTemplate && !sameTemplate(templateRef.current, localTemplate)) {
        setTemplate(localTemplate);
      }
      if (stored.customPrompt) {
        const localPrompt = {
          content: stored.customPrompt,
          fileName: stored.promptFileName,
        };
        if (!samePrompt(promptRef.current, localPrompt)) {
          setPrompt(localPrompt);
        }
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
          if (!sameTemplate(templateRef.current, remoteTemplate)) {
            setTemplate(remoteTemplate);
          }
          saveStoredProfile(userId, {
            resumeTemplateFileName: remoteTemplate.fileName,
            resumeTemplateBase64: remoteTemplate.templateBase64,
            resumeTemplateId: remoteTemplate.templateId,
            resumeTemplateUpdatedAt: undefined,
          });
          templateLoaded = true;
        }
      } catch (err) {
        setError(resumeBuilderAccessDeniedMessage(err));
      }

      try {
        const remotePrompt = await profileApi.fetchPrompt().catch(() => null);
        if (remotePrompt?.content.trim()) {
          const storedAfterLocal = loadStoredProfile(userId);
          const localIsNewer =
            Boolean(storedAfterLocal.customPrompt.trim()) &&
            typeof storedAfterLocal.promptUpdatedAt === "number" &&
            storedAfterLocal.promptUpdatedAt > 0 &&
            // Prefer a just-uploaded local prompt over a possibly cached remote copy.
            storedAfterLocal.customPrompt.trim() !== remotePrompt.content.trim() &&
            Date.now() - storedAfterLocal.promptUpdatedAt < 7 * 24 * 60 * 60 * 1000;

          if (localIsNewer) {
            const localPrompt = {
              content: storedAfterLocal.customPrompt,
              fileName: storedAfterLocal.promptFileName,
            };
            if (!samePrompt(promptRef.current, localPrompt)) {
              setPrompt(localPrompt);
            }
            promptLoaded = true;
          } else {
            if (!samePrompt(promptRef.current, remotePrompt)) {
              setPrompt(remotePrompt);
            }
            saveStoredProfile(userId, {
              customPrompt: remotePrompt.content,
              promptFileName: remotePrompt.fileName,
              promptUpdatedAt: undefined,
            });
            promptLoaded = true;
          }
        }
      } catch (err) {
        setError((err as Error).message || "Could not load writing prompt.");
      }

      if (!templateLoaded && !promptLoaded) {
        hydrateFromLocal();
        if (stored.customPrompt) {
          const localPrompt = {
            content: stored.customPrompt,
            fileName: stored.promptFileName,
          };
          if (!samePrompt(promptRef.current, localPrompt)) {
            setPrompt(localPrompt);
          }
        }
      }

      hasLoadedOnceRef.current = true;
      setLoading(false);
    },
    [userId, hydrateFromLocal]
  );

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    void refresh({ silent: false });
  }, [refresh]);

  // Soft re-fetch when the tab becomes visible again (cross-device uploads).
  // Do not use window "focus" — that also fires when focusing inputs and remounted the form.
  useEffect(() => {
    if (!userId || typeof document === "undefined") return;

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh({ silent: true });
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, refresh]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    const syncTemplateFromStorage = () => {
      hydrateFromLocal();
    };

    const syncPromptFromStorage = () => {
      const stored = loadStoredProfile(userId);
      if (!stored.customPrompt.trim()) return;
      const localPrompt = {
        content: stored.customPrompt,
        fileName: stored.promptFileName,
      };
      if (!samePrompt(promptRef.current, localPrompt)) {
        setPrompt(localPrompt);
      }
    };

    window.addEventListener(PROFILE_TEMPLATE_UPDATED_EVENT, syncTemplateFromStorage);
    window.addEventListener(PROFILE_PROMPT_UPDATED_EVENT, syncPromptFromStorage);
    window.addEventListener("storage", syncTemplateFromStorage);
    window.addEventListener("storage", syncPromptFromStorage);
    return () => {
      window.removeEventListener(PROFILE_TEMPLATE_UPDATED_EVENT, syncTemplateFromStorage);
      window.removeEventListener(PROFILE_PROMPT_UPDATED_EVENT, syncPromptFromStorage);
      window.removeEventListener("storage", syncTemplateFromStorage);
      window.removeEventListener("storage", syncPromptFromStorage);
    };
  }, [userId, hydrateFromLocal]);

  return { template, prompt, loading, error, refresh, setTemplate, setPrompt };
}
