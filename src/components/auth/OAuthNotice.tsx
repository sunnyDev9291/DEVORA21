"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { OAUTH_NOTICE, getOAuthNoticeMessage } from "@/lib/auth-oauth";
import { AUTH_LINKS } from "@/lib/constants";

type OAuthNoticeProps = {
  /** When set, only show notices intended for this page (login vs register). */
  page: "login" | "register";
};

const loginNotices = new Set<string>([
  OAUTH_NOTICE.signupSuccess,
  OAUTH_NOTICE.loginSuccess,
  OAUTH_NOTICE.oauthError,
]);

const registerNotices = new Set<string>([
  OAUTH_NOTICE.googleAlreadyRegistered,
  OAUTH_NOTICE.oauthError,
]);

export default function OAuthNotice({ page }: OAuthNoticeProps) {
  const searchParams = useSearchParams();
  const notice = searchParams.get("notice");
  const customMessage = searchParams.get("message");
  const message = getOAuthNoticeMessage(notice) ?? (notice === OAUTH_NOTICE.oauthError && customMessage ? customMessage : null);

  if (!notice || !message) return null;

  const allowed = page === "login" ? loginNotices : registerNotices;
  if (!allowed.has(notice)) return null;

  const isSuccess =
    notice === OAUTH_NOTICE.signupSuccess || notice === OAUTH_NOTICE.loginSuccess;

  const isAlreadyRegistered = notice === OAUTH_NOTICE.googleAlreadyRegistered;

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        isSuccess
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : isAlreadyRegistered
            ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
            : "border-red-500/30 bg-red-500/10 text-red-300"
      }`}
      role="status"
    >
      <p>{message}</p>
      {isAlreadyRegistered && page === "register" && (
        <p className="mt-2">
          <Link
            href={AUTH_LINKS.login}
            className="font-semibold text-amber-200 underline underline-offset-2 hover:text-white"
          >
            Sign in with Google
          </Link>
        </p>
      )}
    </div>
  );
}
