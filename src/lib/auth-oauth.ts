import { API_BASE_URL } from "@/lib/api-base-url";
import { AUTH_LINKS } from "@/lib/constants";
import { getSafeRedirectPath } from "@/lib/auth-redirect";

export type GoogleOAuthIntent = "signup" | "login";

/** Query param on /login or /register after OAuth redirect. */
export const OAUTH_NOTICE = {
  signupSuccess: "signup_success",
  googleAlreadyRegistered: "google_already_registered",
  loginSuccess: "login_success",
  oauthError: "oauth_error",
} as const;

export type OAuthNotice = (typeof OAUTH_NOTICE)[keyof typeof OAUTH_NOTICE];

export const OAUTH_MESSAGES: Record<OAuthNotice, string> = {
  [OAUTH_NOTICE.signupSuccess]:
    "Your account was created successfully. Please sign in to continue.",
  [OAUTH_NOTICE.googleAlreadyRegistered]:
    "This Google account is already registered. Please sign in instead.",
  [OAUTH_NOTICE.loginSuccess]: "Signed in successfully.",
  [OAUTH_NOTICE.oauthError]: "Google sign-in failed. Please try again.",
};

export function getOAuthNoticeMessage(notice: string | null | undefined): string | null {
  if (!notice) return null;
  if (notice in OAUTH_MESSAGES) {
    return OAUTH_MESSAGES[notice as OAuthNotice];
  }
  return null;
}

function frontendOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin.replace(/\/$/, "");
}

/**
 * Build Google OAuth start URL.
 * Backend should honor: intent, prompt, and redirect URLs (see docs in AUTH_CONTEXT).
 */
export function getGoogleOAuthUrl(options: {
  intent: GoogleOAuthIntent;
  next?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("intent", options.intent);

  if (options.intent === "login") {
    params.set("prompt", "select_account");
  }

  const origin = frontendOrigin();
  if (origin) {
    const completeBase = `${origin}${AUTH_LINKS.oauthComplete}`;

    params.set("complete_url", completeBase);

    if (options.intent === "signup") {
      params.set(
        "signup_success_url",
        `${origin}${AUTH_LINKS.login}?notice=${OAUTH_NOTICE.signupSuccess}`,
      );
      params.set(
        "signup_exists_url",
        `${origin}${AUTH_LINKS.register}?notice=${OAUTH_NOTICE.googleAlreadyRegistered}`,
      );
    } else {
      const destination = getSafeRedirectPath(options.next);
      params.set("login_success_url", `${origin}${destination}`);
      params.set(
        "login_fallback_url",
        `${origin}${AUTH_LINKS.login}?notice=${OAUTH_NOTICE.loginSuccess}`,
      );
    }
  }

  return `${API_BASE_URL}/auth/google?${params.toString()}`;
}
