import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { ApiError, normalizeAuthUser } from "@/lib/auth-api";
import { dataUrlToBlob } from "@/lib/profile-file";
import type { User } from "@/types/auth";

export type UserResumeTemplateAsset = {
  fileName: string;
  templateBase64: string;
};

export type UserPromptAsset = {
  fileName?: string;
  content: string;
};

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function isUnavailableStatus(status: number): boolean {
  return status === 404 || status === 405 || status === 501;
}

async function profileFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return apiAuthFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });
}

async function profileJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await profileFetch(path, options);
  const data = await parseJson<{ message?: string; error?: string } & T>(res);

  if (!res.ok) {
    const message = data?.message || data?.error || "Request failed";
    throw new ApiError(message, res.status, { message });
  }

  return data as T;
}

export type OnboardingFilesPayload = {
  firstName: string;
  lastName: string;
  avatarFile?: File | null;
  avatarDataUrl?: string;
  resumeTemplateFile?: File | null;
  promptFile?: File | null;
  customPrompt?: string;
};

export type ProfileUpdateFilesPayload = {
  firstName?: string;
  lastName?: string;
  avatarFile?: File | null;
  avatarDataUrl?: string;
  resumeTemplateFile?: File | null;
  promptFile?: File | null;
  customPrompt?: string;
};

function appendAvatar(form: FormData, avatarFile?: File | null, avatarDataUrl?: string) {
  if (avatarFile) {
    form.append("avatar", avatarFile, avatarFile.name);
    return;
  }
  if (avatarDataUrl?.startsWith("data:")) {
    const blob = dataUrlToBlob(avatarDataUrl);
    if (blob) form.append("avatar", blob, "avatar.jpg");
  }
}

function buildOnboardingFormData(payload: OnboardingFilesPayload): FormData {
  const form = new FormData();
  form.append("firstName", payload.firstName.trim());
  form.append("lastName", payload.lastName.trim());
  form.append("onboardingCompleted", "true");

  appendAvatar(form, payload.avatarFile, payload.avatarDataUrl);

  if (payload.resumeTemplateFile) {
    form.append("resumeTemplate", payload.resumeTemplateFile, payload.resumeTemplateFile.name);
  }
  if (payload.promptFile) {
    form.append("promptFile", payload.promptFile, payload.promptFile.name);
  }
  if (payload.customPrompt?.trim()) {
    form.append("customPrompt", payload.customPrompt.trim());
  }

  return form;
}

function buildProfileUpdateFormData(payload: ProfileUpdateFilesPayload): FormData {
  const form = new FormData();
  if (payload.firstName !== undefined) form.append("firstName", payload.firstName.trim());
  if (payload.lastName !== undefined) form.append("lastName", payload.lastName.trim());

  appendAvatar(form, payload.avatarFile, payload.avatarDataUrl);

  if (payload.resumeTemplateFile) {
    form.append("resumeTemplate", payload.resumeTemplateFile, payload.resumeTemplateFile.name);
  }
  if (payload.promptFile) {
    form.append("promptFile", payload.promptFile, payload.promptFile.name);
  }
  if (payload.customPrompt !== undefined) {
    form.append("customPrompt", payload.customPrompt.trim());
  }

  return form;
}

async function postMultipart(path: string, form: FormData): Promise<User> {
  const res = await profileFetch(path, { method: "POST", body: form });
  const data = await parseJson<Record<string, unknown>>(res);

  if (!res.ok) {
    const message =
      (data && typeof data.message === "string" && data.message) ||
      (data && typeof data.error === "string" && data.error) ||
      "Request failed";
    throw new ApiError(message, res.status, { message });
  }

  return normalizeAuthUser(data);
}

async function patchMultipart(path: string, form: FormData): Promise<User> {
  const res = await profileFetch(path, { method: "PATCH", body: form });
  const data = await parseJson<Record<string, unknown>>(res);

  if (!res.ok) {
    const message =
      (data && typeof data.message === "string" && data.message) ||
      (data && typeof data.error === "string" && data.error) ||
      "Request failed";
    throw new ApiError(message, res.status, { message });
  }

  return normalizeAuthUser(data);
}

export const profileApi = {
  async completeOnboarding(payload: OnboardingFilesPayload): Promise<User> {
    const form = buildOnboardingFormData(payload);
    try {
      return await postMultipart("/auth/onboarding", form);
    } catch (err) {
      if (err instanceof ApiError && isUnavailableStatus(err.status)) {
        return patchMultipart("/auth/profile", form);
      }
      throw err;
    }
  },

  async updateProfile(payload: ProfileUpdateFilesPayload): Promise<User> {
    const form = buildProfileUpdateFormData(payload);
    return patchMultipart("/auth/profile", form);
  },

  async fetchPrompt(): Promise<UserPromptAsset> {
    const data = await profileJson<{ content?: string; fileName?: string; promptFileName?: string }>(
      "/auth/profile/prompt",
    );
    return {
      content: String(data.content ?? ""),
      fileName: data.fileName || data.promptFileName,
    };
  },

  async fetchResumeTemplate(): Promise<UserResumeTemplateAsset> {
    const data = await profileJson<{
      fileName?: string;
      resumeTemplateFileName?: string;
      templateBase64?: string;
    }>("/auth/profile/resume-template");

    const fileName = data.fileName || data.resumeTemplateFileName || "resume.docx";
    const templateBase64 = String(data.templateBase64 ?? "");
    if (!templateBase64) {
      throw new ApiError("Resume template data missing.", 404);
    }

    return { fileName, templateBase64 };
  },
};
