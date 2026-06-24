import { ApiError, getApiErrorMessage } from "@/lib/auth-api";

export const GOOGLE_ACCOUNT_NO_PASSWORD_MESSAGE =
  "This account uses Google sign-in. Password reset is not available — please use Sign in with Google on the login page.";

function messageLooksLikeGoogleAccount(message: string): boolean {
  return /google|oauth|social|no password|password not set|sign in with google|third.party|external provider/i.test(
    message,
  );
}

export function isGoogleAccountAuthError(error: unknown): boolean {
  if (error instanceof ApiError) {
    const message = error.data?.message ?? error.message ?? "";
    if (messageLooksLikeGoogleAccount(message)) return true;

    const emailError = error.data?.errors?.email?.[0] ?? "";
    if (messageLooksLikeGoogleAccount(emailError)) return true;

    // Backend may use a dedicated status code for OAuth-only accounts.
    if (error.status === 422 || error.status === 403) {
      const code = String((error.data as { code?: string } | undefined)?.code ?? "");
      if (/google|oauth|social/i.test(code)) return true;
    }
  }

  const fallback = getApiErrorMessage(error, "");
  return messageLooksLikeGoogleAccount(fallback);
}

export function getForgotPasswordErrorMessage(
  error: unknown,
  fallback = "Unable to send reset email. Please try again.",
): string {
  if (isGoogleAccountAuthError(error)) {
    if (error instanceof ApiError) {
      const message = error.data?.message ?? error.message;
      if (message && messageLooksLikeGoogleAccount(message)) return message;
    }
    return GOOGLE_ACCOUNT_NO_PASSWORD_MESSAGE;
  }

  return getApiErrorMessage(error, fallback);
}

export function getLoginErrorMessage(
  error: unknown,
  fallback = "Login failed. Please try again.",
): string {
  if (isGoogleAccountAuthError(error)) {
    if (error instanceof ApiError) {
      const message = error.data?.message ?? error.message;
      if (message && messageLooksLikeGoogleAccount(message)) return message;
    }
    return "This account uses Google sign-in. Please use Sign in with Google instead.";
  }

  return getApiErrorMessage(error, fallback);
}
