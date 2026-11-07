"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { ApiError, getApiErrorMessage } from "@/lib/auth-api";
import {
  integrationsApi,
  integrationSettingsHref,
  isIntegrationKeyMissingError,
} from "@/lib/integrations-api";
import {
  getDefaultJobCommunityProfileId,
  hasJobCommunityIntegrationKey,
  JOB_COMMUNITY_KEY_CHANGED_EVENT,
  JOB_COMMUNITY_PROFILE_CHANGED_EVENT,
} from "@/lib/job-community-storage";

type AddBidLogButtonProps = {
  archiveId: string | null | undefined;
  jobUrl?: string | null;
  variant?: "outline" | "secondary" | "primary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Compact inline feedback next to the button (default true). */
  showInlineFeedback?: boolean;
};

export default function AddBidLogButton({
  archiveId,
  jobUrl,
  variant = "outline",
  size = "sm",
  className,
  showInlineFeedback = true,
}: AddBidLogButtonProps) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "warn" | "err";
    text: string;
  } | null>(null);
  const [needsKey, setNeedsKey] = useState(false);

  const syncVisibility = useCallback(() => {
    setVisible(hasJobCommunityIntegrationKey());
  }, []);

  useEffect(() => {
    syncVisibility();
    const onChange = () => syncVisibility();
    window.addEventListener(JOB_COMMUNITY_KEY_CHANGED_EVENT, onChange);
    window.addEventListener(JOB_COMMUNITY_PROFILE_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(JOB_COMMUNITY_KEY_CHANGED_EVENT, onChange);
      window.removeEventListener(JOB_COMMUNITY_PROFILE_CHANGED_EVENT, onChange);
    };
  }, [syncVisibility]);

  if (!visible || !archiveId?.trim()) {
    return null;
  }

  async function handleClick() {
    if (submitting) return;
    const id = archiveId?.trim();
    if (!id) return;

    const profileId = getDefaultJobCommunityProfileId(user?.id)?.trim();
    if (!profileId) {
      setNeedsKey(false);
      setFeedback({
        tone: "err",
        text: "Pick a default Job Community profile under My account first.",
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    setNeedsKey(false);
    try {
      const result = await integrationsApi.createBidLog({
        profile_id: profileId,
        archive_id: id,
        job_url: jobUrl?.trim() || undefined,
      });

      const warningText = integrationsApi.formatWarnings(result.warnings);
      if (result.confirmed_warnings && warningText) {
        setFeedback({
          tone: "warn",
          text: `${result.message} ${warningText}`.trim(),
        });
      } else {
        setFeedback({
          tone: "ok",
          text: result.message || "Bid log created successfully.",
        });
      }
    } catch (err) {
      if (isIntegrationKeyMissingError(err)) {
        setNeedsKey(true);
        setFeedback({
          tone: "err",
          text: getApiErrorMessage(err, "Integration key is missing or invalid."),
        });
      } else if (err instanceof ApiError && err.status === 400) {
        setFeedback({
          tone: "err",
          text: getApiErrorMessage(err, "Could not create bid log."),
        });
      } else {
        setFeedback({
          tone: "err",
          text: getApiErrorMessage(err, "Could not create bid log."),
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="inline-flex max-w-full flex-col items-start gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={submitting}
        onClick={() => void handleClick()}
      >
        {submitting ? "Adding…" : "Add bid log"}
      </Button>
      {showInlineFeedback && feedback ? (
        <p
          className={`max-w-xs text-xs font-medium ${
            feedback.tone === "ok"
              ? "text-emerald-700 dark:text-emerald-300"
              : feedback.tone === "warn"
                ? "text-amber-700 dark:text-amber-300"
                : "text-red-700 dark:text-red-300"
          }`}
          role="status"
        >
          {feedback.text}
          {needsKey || feedback.text.toLowerCase().includes("my account") ? (
            <>
              {" "}
              <Link
                href={integrationSettingsHref()}
                className="underline underline-offset-2 hover:opacity-90"
              >
                Open My account
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
