import { AUTH_LINKS } from "@/lib/constants";
import { isUserEmailVerified } from "@/lib/email-verification";
import type { User } from "@/types/auth";

const ALLOWED_PREFIXES = ["/dashboard", "/resume", "/real-time-interview"];

/** Only allow internal app paths — blocks open redirects. */
export function getSafeRedirectPath(next: string | null | undefined, fallback = AUTH_LINKS.dashboard): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes("://")) return fallback;

  const path = next.split("?")[0];
  if (path === AUTH_LINKS.login || path === AUTH_LINKS.register) return fallback;

  const allowed = ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  return allowed ? next : fallback;
}

/** After login/register/OAuth — verified users go to their destination; others wait for email verification. */
export function getPostAuthRedirectPath(user: User, next?: string | null): string {
  if (!isUserEmailVerified(user)) {
    return AUTH_LINKS.verifyEmailPending;
  }

  return getSafeRedirectPath(next);
}

export function buildLoginUrl(nextPath?: string): string {
  if (!nextPath || nextPath === AUTH_LINKS.login || nextPath === AUTH_LINKS.register) {
    return AUTH_LINKS.login;
  }

  const pathOnly = nextPath.split("?")[0];
  const allowed = ALLOWED_PREFIXES.some((prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`));
  if (!allowed) return AUTH_LINKS.login;

  return `${AUTH_LINKS.login}?next=${encodeURIComponent(nextPath)}`;
}
