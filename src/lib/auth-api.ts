import { API_BASE_URL } from "@/lib/api-base-url";
import { readEmailVerified, mergeEmailVerifiedState } from "@/lib/email-verification";
import type {
  AuthResponse,
  MessageResponse,
  User,
  UserProfileUpdate,
  ApiError as ApiErrorBody,
} from "@/types/auth";
import type { OnboardingFilesPayload, ProfileUpdateFilesPayload } from "@/lib/profile-api";
import { profileApi } from "@/lib/profile-api";

export class ApiError extends Error {  status: number;
  data?: ApiErrorBody;

  constructor(message: string, status: number, data?: ApiErrorBody) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });

  const data = await parseJson<ApiErrorBody & T>(res);

  if (!res.ok) {
    const message = getApiErrorMessage(data ?? { message: undefined }, "Request failed");
    throw new ApiError(message, res.status, data ?? undefined);
  }

  return data as T;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong",
): string {
  if (error instanceof ApiError) {
    if (error.data?.message) return error.data.message;
    if (error.data?.errors) {
      const first = Object.values(error.data.errors)[0];
      if (first?.[0]) return first[0];
    }
    if (error.status === 401) return "Invalid email or password";
    if (error.status === 403) return "You do not have permission to perform this action";
    if (error.status === 404) return "Resource not found";
    if (error.status === 422) return "Please check your input and try again";
    if (error.status === 429) return "Too many requests. Please try again later";
    if (error.status >= 500) return "Server error. Please try again later";
    return error.message || fallback;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as ApiErrorBody).message;
    if (message) return message;
    const errors = (error as ApiErrorBody).errors;
    if (errors) {
      const first = Object.values(errors)[0];
      if (first?.[0]) return first[0];
    }
  }

  if (typeof error === "number") {
    if (error === 401) return "Invalid email or password";
    if (error === 403) return "You do not have permission to perform this action";
    if (error === 404) return "Resource not found";
    if (error === 422) return "Please check your input and try again";
    if (error === 429) return "Too many requests. Please try again later";
    if (error >= 500) return "Server error. Please try again later";
  }

  if (error instanceof Error) return error.message;
  return fallback;
}

export const REGISTER_EMAIL_EXISTS_MESSAGE =
  "An account with this email already exists. Sign in instead.";

function messageLooksLikeDuplicateEmail(message: string): boolean {
  return /already|exist|taken|duplicate|registered/i.test(message);
}

export function isDuplicateEmailRegisterError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 409) return true;

  const emailError = error.data?.errors?.email?.[0];
  if (emailError && messageLooksLikeDuplicateEmail(emailError)) return true;

  const message = error.data?.message ?? error.message;
  return Boolean(message && messageLooksLikeDuplicateEmail(message));
}

export function getRegisterErrorMessage(
  error: unknown,
  fallback = "Registration failed. Please try again.",
): string {
  if (isDuplicateEmailRegisterError(error)) {
    if (error instanceof ApiError) {
      const emailError = error.data?.errors?.email?.[0];
      if (emailError) return emailError;

      const message = error.data?.message ?? error.message;
      if (message && messageLooksLikeDuplicateEmail(message)) return message;
    }

    return REGISTER_EMAIL_EXISTS_MESSAGE;
  }

  if (error instanceof ApiError && error.data?.errors?.email?.[0]) {
    return error.data.errors.email[0];
  }

  return getApiErrorMessage(error, fallback);
}

function splitFullName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  const space = trimmed.indexOf(" ");
  if (space === -1) {
    return { firstName: trimmed, lastName: trimmed };
  }
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1).trim() || trimmed.slice(0, space),
  };
}

function toRawUserRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};

  let obj = raw as Record<string, unknown>;

  const data = obj.data;
  if (data && typeof data === "object") {
    obj = { ...obj, ...(data as Record<string, unknown>) };
  }

  const nested = obj.user;
  if (nested && typeof nested === "object") {
    return { ...obj, ...(nested as Record<string, unknown>) };
  }

  return obj;
}

/** Read resume builder flag from common backend field names. Undefined when absent. */
function readResumeBuilderEnabled(raw: Record<string, unknown>): boolean | undefined {
  const keys = [
    "resumeBuilderEnabled",
    "resume_builder_enabled",
    "resumeBuilderAccess",
    "resume_builder_access",
  ] as const;

  for (const key of keys) {
    if (!(key in raw)) continue;
    const value = raw[key];
    if (value === true || value === "true" || value === 1) return true;
    if (value === false || value === "false" || value === 0) return false;
  }

  return undefined;
}

export function mergeAuthUserState(previous: User | null, next: User): User {
  let merged = mergeEmailVerifiedState(previous, next);

  if (previous && previous.id === next.id && next.resumeBuilderEnabled === undefined) {
    if (previous.resumeBuilderEnabled !== undefined) {
      merged = { ...merged, resumeBuilderEnabled: previous.resumeBuilderEnabled };
    }
  }

  return merged;
}

/** Backend may return firstName/lastName/avatar instead of name, or nest under `user`. */
export function normalizeAuthUser(raw: unknown): User {
  const source = toRawUserRecord(raw);

  const id = String(source.id ?? source._id ?? source.userId ?? "").trim();
  const email = String(source.email ?? "").trim();

  const avatarRaw = source.avatar ?? source.avatarUrl ?? source.picture;
  const avatar =
    typeof avatarRaw === "string"
      ? avatarRaw.trim()
      : "";

  let firstName = typeof source.firstName === "string" ? source.firstName.trim() : "";
  let lastName = typeof source.lastName === "string" ? source.lastName.trim() : "";
  const nameField = typeof source.name === "string" ? source.name.trim() : "";

  if (!firstName && !lastName && nameField) {
    const split = splitFullName(nameField);
    firstName = split.firstName;
    lastName = split.lastName;
  }

  const name =
    nameField ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    email;

  const emailVerified = readEmailVerified(source);

  const onboardingCompleted =
    source.onboardingCompleted === true ||
    source.onboardingComplete === true ||
    source.profileCompleted === true;

  const resumeTemplateFileName =
    typeof source.resumeTemplateFileName === "string"
      ? source.resumeTemplateFileName.trim()
      : typeof source.resumeTemplateName === "string"
        ? source.resumeTemplateName.trim()
        : undefined;

  const promptFileName =
    typeof source.promptFileName === "string" ? source.promptFileName.trim() : undefined;

  const resumeBuilderEnabled = readResumeBuilderEnabled(source);

  const createdAt =
    typeof source.createdAt === "string" ? source.createdAt : undefined;

  return {
    id,
    email,
    emailVerified,
    onboardingCompleted: onboardingCompleted || undefined,
    ...(resumeBuilderEnabled !== undefined ? { resumeBuilderEnabled } : {}),
    resumeTemplateFileName: resumeTemplateFileName || undefined,
    promptFileName: promptFileName || undefined,
    createdAt,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    name,
    avatar: avatar || undefined,
  };
}

export function isValidAuthUser(user: User | null | undefined): user is User {
  return Boolean(user?.id?.trim() && user?.email?.trim());
}

export const authApi = {
  getMe: () =>
    apiRequest<unknown>("/auth/me").then((data) => ({
      data: normalizeAuthUser(data),
    })),

  login: (email: string, password: string, rememberMe = true) =>
    apiRequest<AuthResponse & Record<string, unknown>>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, rememberMe }),
    }).then((data) => {
      const user = normalizeAuthUser(data.user ?? data);
      return { data: { ...data, user } };
    }),

  /** Extend an existing session cookie (sliding / long-lived sessions). */
  refreshSession: () =>
    apiRequest<MessageResponse>("/auth/refresh", { method: "POST" }).then((data) => ({ data })),

  register: (name: string, email: string, password: string) => {
    const { firstName, lastName } = splitFullName(name);
    return apiRequest<AuthResponse & Record<string, unknown>>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, firstName, lastName }),
    }).then((data) => {
      const user = normalizeAuthUser(data.user ?? data);
      return { data: { ...data, user } };
    });
  },

  updateProfile: (body: UserProfileUpdate) =>
    apiRequest<unknown>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }).then((data) => ({ data: normalizeAuthUser(data) })),

  updateProfileWithFiles: (payload: ProfileUpdateFilesPayload) =>
    profileApi.updateProfile(payload).then((user) => ({ data: user })),

  completeOnboarding: (payload: OnboardingFilesPayload) =>
    profileApi.completeOnboarding(payload).then((user) => ({ data: user })),

  logout: () =>
    apiRequest<MessageResponse>("/auth/logout", { method: "POST" }).then((data) => ({ data })),

  forgotPassword: (email: string) =>
    apiRequest<MessageResponse>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }).then((data) => ({ data })),

  resetPassword: (token: string, password: string) =>
    apiRequest<MessageResponse>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }).then((data) => ({ data })),

  verifyEmail: (token: string) =>
    apiRequest<MessageResponse>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }).then((data) => ({ data })),
};

export { getGoogleOAuthUrl } from "@/lib/auth-oauth";
