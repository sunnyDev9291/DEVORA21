import { ApiError } from "@/lib/auth-api";
import type { User } from "@/types/auth";

export const RESUME_ACCESS_NOTICE = "resume_access_pending";

export const RESUME_BUILDER_ACCESS_MESSAGE =
  "Resume builder access is not enabled for your account yet. Please contact support or wait for approval.";

/** Only explicit true grants access; missing field is false. */
export function isResumeBuilderEnabled(user: User | null | undefined): boolean {
  return user?.resumeBuilderEnabled === true;
}

export function isResumeBuilderAccessDenied(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 403) return false;
  const message = (error.data?.message ?? error.message ?? "").toLowerCase();
  return message.includes("resume builder access not enabled");
}

export function resumeBuilderAccessDeniedMessage(error: unknown): string {
  if (isResumeBuilderAccessDenied(error)) {
    return RESUME_BUILDER_ACCESS_MESSAGE;
  }
  if (error instanceof ApiError && error.status === 403) {
    return error.data?.message || error.message || RESUME_BUILDER_ACCESS_MESSAGE;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return RESUME_BUILDER_ACCESS_MESSAGE;
}

export function resumeAccessPendingUrl(): string {
  return `/dashboard?notice=${RESUME_ACCESS_NOTICE}`;
}
