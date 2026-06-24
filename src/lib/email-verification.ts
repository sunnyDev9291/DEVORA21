import type { User } from "@/types/auth";

type RawUserFields = Record<string, unknown>;

/** Read verification flag from common backend field names. Returns undefined when absent. */
export function readEmailVerified(raw: RawUserFields): boolean | undefined {
  const keys = [
    "emailVerified",
    "email_verified",
    "isEmailVerified",
    "is_email_verified",
    "verified",
  ] as const;

  for (const key of keys) {
    const value = raw[key];
    if (value === true || value === "true" || value === 1) return true;
    if (value === false || value === "false" || value === 0) return false;
  }

  const provider = String(
    raw.provider ?? raw.authProvider ?? raw.oauthProvider ?? "",
  ).toLowerCase();

  if (provider.includes("google") || provider === "oauth") {
    return true;
  }

  return undefined;
}

/** Only explicit true grants access to verified-only features. */
export function isUserEmailVerified(user: User | null | undefined): boolean {
  return user?.emailVerified === true;
}

export function mergeEmailVerifiedState(previous: User | null, next: User): User {
  if (next.emailVerified !== undefined || !previous || previous.id !== next.id) {
    return next;
  }

  if (previous.emailVerified !== undefined) {
    return { ...next, emailVerified: previous.emailVerified };
  }

  return next;
}
