import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { ApiError, normalizeAuthUser } from "@/lib/auth-api";
import { compactListingUrls } from "@/lib/builtin-crawl-types";
import { dataUrlToBlob } from "@/lib/profile-file";
import type { ProfileListingUrls, User } from "@/types/auth";

export type AdminUserSummary = {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
  onboardingCompleted?: boolean;
  resumeBuilderEnabled?: boolean;
  createdAt?: string;
};

export type AdminUsersListResponse = {
  users: AdminUserSummary[];
  total: number;
  page: number;
  limit: number;
};

export type AdminProfileUpdatePayload = {
  firstName?: string;
  lastName?: string;
  avatarFile?: File | null;
  avatarDataUrl?: string;
  resumeTemplateFile?: File | null;
  promptFile?: File | null;
  customPrompt?: string;
  listingUrls?: ProfileListingUrls;
  resumeBuilderEnabled?: boolean;
};

export type AdminPromptAsset = {
  content: string;
  fileName?: string;
};

export type AdminResumeTemplateAsset = {
  fileName: string;
  templateId?: string;
  templateBase64?: string;
};

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function pickString(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return undefined;
}

function normalizeSummary(raw: unknown): AdminUserSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const nested =
    source.user && typeof source.user === "object"
      ? (source.user as Record<string, unknown>)
      : source;
  const id = pickString(nested, "id", "_id", "userId");
  const email = pickString(nested, "email");
  if (!id && !email) return null;

  const firstName = pickString(nested, "firstName");
  const lastName = pickString(nested, "lastName");
  const name =
    pickString(nested, "name") ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    undefined;

  return {
    id: id || email,
    email,
    name,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    emailVerified: toBool(nested.emailVerified ?? nested.email_verified),
    onboardingCompleted: toBool(
      nested.onboardingCompleted ?? nested.onboarding_completed ?? nested.profileCompleted
    ),
    resumeBuilderEnabled: toBool(
      nested.resumeBuilderEnabled ?? nested.resume_builder_enabled
    ),
    createdAt: pickString(nested, "createdAt", "created_at") || undefined,
  };
}

async function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return apiAuthFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });
}

async function adminJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await adminFetch(path, options);
  const data = await parseJson<Record<string, unknown> & T>(res);

  if (!res.ok) {
    const message =
      (data && typeof data.message === "string" && data.message) ||
      (data && typeof data.error === "string" && data.error) ||
      (res.status === 403
        ? "Admin access required. Sign in with a super-admin account."
        : res.status === 401
          ? "Sign in to Devora21 first, then open Super Admin."
          : "Request failed");
    throw new ApiError(message, res.status, { message });
  }

  return data as T;
}

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

function buildAdminProfileForm(payload: AdminProfileUpdatePayload): FormData {
  const form = new FormData();
  if (payload.firstName !== undefined) form.append("firstName", payload.firstName.trim());
  if (payload.lastName !== undefined) form.append("lastName", payload.lastName.trim());
  if (payload.resumeBuilderEnabled !== undefined) {
    form.append("resumeBuilderEnabled", payload.resumeBuilderEnabled ? "true" : "false");
  }

  appendAvatar(form, payload.avatarFile, payload.avatarDataUrl);

  if (payload.resumeTemplateFile) {
    form.append("resumeTemplate", payload.resumeTemplateFile, payload.resumeTemplateFile.name);
  }
  if (payload.promptFile instanceof File) {
    form.append("promptFile", payload.promptFile, payload.promptFile.name);
  } else if (payload.customPrompt?.trim()) {
    form.append("customPrompt", payload.customPrompt.trim());
  }
  if (payload.listingUrls !== undefined) {
    const compact = compactListingUrls(payload.listingUrls) ?? {};
    form.append("listingUrls", JSON.stringify(compact));
    for (const [platform, url] of Object.entries(compact)) {
      if (url) form.append(`listingUrl_${platform}`, url);
    }
  }

  return form;
}

export const superAdminApi = {
  async listUsers(params: {
    q?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<AdminUsersListResponse> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const search = new URLSearchParams();
    search.set("page", String(page));
    search.set("limit", String(limit));
    if (params.q?.trim()) search.set("q", params.q.trim());

    const data = await adminJson<Record<string, unknown>>(
      `/admin/users?${search.toString()}`
    );

    const rawList = Array.isArray(data.users)
      ? data.users
      : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.data)
          ? data.data
          : [];

    const users = rawList
      .map(normalizeSummary)
      .filter((u): u is AdminUserSummary => Boolean(u));

    const totalRaw = data.total ?? data.totalCount ?? data.count;
    const total =
      typeof totalRaw === "number" && Number.isFinite(totalRaw) ? totalRaw : users.length;

    return { users, total, page, limit };
  },

  async getUser(userId: string): Promise<User> {
    const id = userId.trim();
    if (!id) throw new ApiError("User id is required.", 400);
    const data = await adminJson<Record<string, unknown>>(
      `/admin/users/${encodeURIComponent(id)}`
    );
    return normalizeAuthUser(data);
  },

  async updateUser(userId: string, payload: AdminProfileUpdatePayload): Promise<User> {
    const id = userId.trim();
    if (!id) throw new ApiError("User id is required.", 400);
    const form = buildAdminProfileForm(payload);
    const res = await adminFetch(`/admin/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: form,
    });
    const data = await parseJson<Record<string, unknown>>(res);
    if (!res.ok) {
      const message =
        (data && typeof data.message === "string" && data.message) ||
        (data && typeof data.error === "string" && data.error) ||
        "Could not update user profile.";
      throw new ApiError(message, res.status, { message });
    }
    return normalizeAuthUser(data);
  },

  async fetchPrompt(userId: string): Promise<AdminPromptAsset> {
    const id = userId.trim();
    const data = await adminJson<{
      content?: string;
      fileName?: string;
      promptFileName?: string;
    }>(`/admin/users/${encodeURIComponent(id)}/prompt`);
    return {
      content: String(data.content ?? ""),
      fileName: data.fileName || data.promptFileName,
    };
  },

  async uploadPromptFile(
    userId: string,
    file: File,
    content?: string
  ): Promise<AdminPromptAsset & { serverMatchesUpload: boolean }> {
    if (!(file instanceof File)) {
      throw new ApiError("Select a real prompt file to upload.", 400);
    }
    const { readPromptFile } = await import("@/lib/profile-file");
    const uploadedContent = (content ?? (await readPromptFile(file))).trim();
    if (!uploadedContent) throw new ApiError("Prompt file is empty.", 400);

    const form = new FormData();
    form.append("promptFile", file, file.name);
    form.append("customPrompt", uploadedContent);
    form.append("promptContent", uploadedContent);

    const res = await adminFetch(`/admin/users/${encodeURIComponent(userId.trim())}`, {
      method: "PATCH",
      body: form,
    });
    if (!res.ok) {
      const data = await parseJson<{ message?: string; error?: string }>(res);
      throw new ApiError(
        data?.message || data?.error || "Prompt upload failed.",
        res.status
      );
    }

    let server: AdminPromptAsset;
    try {
      server = await this.fetchPrompt(userId);
    } catch {
      return {
        content: uploadedContent,
        fileName: file.name,
        serverMatchesUpload: false,
      };
    }

    return {
      content: uploadedContent,
      fileName: server.fileName || file.name,
      serverMatchesUpload: server.content.trim() === uploadedContent,
    };
  },

  async fetchResumeTemplate(userId: string): Promise<AdminResumeTemplateAsset> {
    const id = userId.trim();
    const data = await adminJson<{
      fileName?: string;
      resumeTemplateFileName?: string;
      templateBase64?: string;
      templateId?: string;
      resumeTemplateId?: string;
      id?: string;
    }>(`/admin/users/${encodeURIComponent(id)}/resume-template`);

    const fileName = data.fileName || data.resumeTemplateFileName || "resume.docx";
    const templateBase64 = String(data.templateBase64 ?? "").trim() || undefined;
    const templateId =
      String(data.templateId ?? data.resumeTemplateId ?? data.id ?? "").trim() || undefined;

    if (!templateId && !templateBase64) {
      throw new ApiError("Resume template data missing.", 404);
    }

    return { fileName, templateId, templateBase64 };
  },

  /**
   * WYSIWYG PDF preview for another user’s stored DOCX template.
   * Prefers GET /admin/users/:id/resume-template/pdf, then /resume/templates/:templateId/pdf.
   */
  async fetchResumeTemplatePreviewPdf(
    userId: string,
    templateId?: string
  ): Promise<{ blob: Blob; fileName: string }> {
    const id = userId.trim();
    const candidates = [
      `/admin/users/${encodeURIComponent(id)}/resume-template/pdf`,
      ...(templateId?.trim()
        ? [`/resume/templates/${encodeURIComponent(templateId.trim())}/pdf`]
        : []),
    ];

    let lastError: Error | null = null;
    for (const path of candidates) {
      try {
        const res = await adminFetch(path, { method: "GET" });
        const contentType = res.headers.get("content-type") ?? "";
        if (!res.ok) {
          const data = await parseJson<{ message?: string; error?: string }>(res);
          lastError = new ApiError(
            data?.message || data?.error || `Template PDF preview unavailable (${res.status}).`,
            res.status
          );
          if (res.status === 404 || res.status === 501) continue;
          throw lastError;
        }

        if (contentType.includes("application/json")) {
          const data = await parseJson<{
            pdfBase64?: string;
            fileName?: string;
            filename?: string;
          }>(res);
          const b64 = String(data?.pdfBase64 ?? "").trim();
          if (!b64) {
            lastError = new ApiError("Template PDF payload missing.", 502);
            continue;
          }
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          return {
            blob: new Blob([bytes], { type: "application/pdf" }),
            fileName: data?.fileName || data?.filename || "resume-template.pdf",
          };
        }

        const blob = await res.blob();
        const disposition = res.headers.get("content-disposition") || "";
        const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disposition);
        const fileName = match
          ? decodeURIComponent(match[1].replace(/"/g, "").trim())
          : "resume-template.pdf";
        return { blob, fileName };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (err instanceof ApiError && err.status !== 404 && err.status !== 501) throw err;
      }
    }
    throw lastError ?? new ApiError("Could not load template PDF preview.", 502);
  },

  /** Persist prompt text for a user (editable textarea save). */
  async savePrompt(userId: string, content: string, fileName?: string): Promise<AdminPromptAsset> {
    const id = userId.trim();
    const trimmed = content.trim();
    if (!trimmed) throw new ApiError("Prompt cannot be empty.", 400);

    const form = new FormData();
    form.append("customPrompt", trimmed);
    form.append("promptContent", trimmed);
    if (fileName?.trim()) form.append("promptFileName", fileName.trim());

    const res = await adminFetch(`/admin/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: form,
    });
    if (!res.ok) {
      const data = await parseJson<{ message?: string; error?: string }>(res);
      throw new ApiError(data?.message || data?.error || "Could not save prompt.", res.status);
    }

    try {
      return await this.fetchPrompt(id);
    } catch {
      return { content: trimmed, fileName: fileName?.trim() || undefined };
    }
  },

  /**
   * Load a user’s avatar as a blob URL (works when the image requires auth cookies).
   * Tries GET /admin/users/:id/avatar, then an authenticated GET of the known avatar URL.
   */
  async fetchAvatarObjectUrl(
    userId: string,
    avatarUrl?: string | null
  ): Promise<string | null> {
    const id = userId.trim();
    const candidates: string[] = [`/admin/users/${encodeURIComponent(id)}/avatar`];
    const direct = avatarUrl?.trim();
    if (direct) {
      if (direct.startsWith("data:") || direct.startsWith("blob:")) return direct;
      if (/^https?:\/\//i.test(direct)) {
        candidates.push(direct);
      } else if (direct.startsWith("/")) {
        candidates.push(direct);
      }
    }

    for (const pathOrUrl of candidates) {
      try {
        const res = pathOrUrl.startsWith("http")
          ? await apiAuthFetch(pathOrUrl, { method: "GET", headers: { Accept: "image/*,*/*" } })
          : await adminFetch(pathOrUrl, { method: "GET", headers: { Accept: "image/*,*/*" } });
        if (!res.ok) continue;
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const data = await parseJson<{
            avatar?: string;
            avatarUrl?: string;
            url?: string;
            dataUrl?: string;
          }>(res);
          const nested =
            data?.dataUrl?.trim() ||
            data?.avatar?.trim() ||
            data?.avatarUrl?.trim() ||
            data?.url?.trim();
          if (nested?.startsWith("data:")) return nested;
          if (nested) {
            // Recurse once on nested URL without looping forever
            if (nested !== pathOrUrl && !nested.startsWith("data:")) {
              const nestedRes = nested.startsWith("http")
                ? await apiAuthFetch(nested, { method: "GET", headers: { Accept: "image/*,*/*" } })
                : await adminFetch(
                    nested.startsWith("/") ? nested : `/${nested}`,
                    { method: "GET", headers: { Accept: "image/*,*/*" } }
                  );
              if (nestedRes.ok) {
                const blob = await nestedRes.blob();
                if (blob.size > 0) return URL.createObjectURL(blob);
              }
            }
          }
          continue;
        }
        const blob = await res.blob();
        if (blob.size > 0 && (contentType.startsWith("image/") || contentType.includes("octet-stream") || !contentType)) {
          return URL.createObjectURL(blob);
        }
      } catch {
        // try next candidate
      }
    }
    return direct && /^https?:\/\//i.test(direct) ? direct : null;
  },

  /** Permanently delete a user profile/account. */
  async deleteUser(userId: string): Promise<void> {
    const id = userId.trim();
    if (!id) throw new ApiError("User id is required.", 400);

    const candidates = [
      `/admin/users/${encodeURIComponent(id)}`,
      `/admin/users/${encodeURIComponent(id)}/delete`,
    ];

    let lastError: Error | null = null;
    for (const path of candidates) {
      try {
        const res = await adminFetch(path, {
          method: path.endsWith("/delete") ? "POST" : "DELETE",
        });
        if (res.ok || res.status === 204) return;
        const data = await parseJson<{ message?: string; error?: string }>(res);
        lastError = new ApiError(
          data?.message || data?.error || `Could not delete user (${res.status}).`,
          res.status
        );
        if (res.status === 404 || res.status === 405 || res.status === 501) continue;
        throw lastError;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (err instanceof ApiError && err.status !== 404 && err.status !== 405 && err.status !== 501) {
          throw err;
        }
      }
    }
    throw lastError ?? new ApiError("Could not delete user.", 502);
  },
};
