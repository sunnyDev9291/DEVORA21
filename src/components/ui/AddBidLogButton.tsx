"use client";

import dynamic from "next/dynamic";
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

const Modal = dynamic(() => import("@/components/ui/Modal"), { ssr: false });

type AddBidLogButtonProps = {
  archiveId: string | null | undefined;
  jobUrl?: string | null;
  variant?: "outline" | "secondary" | "primary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Brief success message under the button (errors/warnings use an alert dialog). */
  showInlineFeedback?: boolean;
};

type Feedback = {
  tone: "ok" | "warn" | "err";
  text: string;
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
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
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

  function showAlert(next: Feedback, requireKey = false) {
    setNeedsKey(requireKey);
    setFeedback(next);
    if (next.tone === "err" || next.tone === "warn") {
      setAlertOpen(true);
    } else {
      setAlertOpen(false);
    }
  }

  function dismissAlert() {
    setAlertOpen(false);
  }

  if (!visible || !archiveId?.trim()) {
    return null;
  }

  async function handleClick() {
    if (submitting) return;
    const id = archiveId?.trim();
    if (!id) return;

    const profileId = getDefaultJobCommunityProfileId(user?.id)?.trim();
    if (!profileId) {
      showAlert(
        {
          tone: "err",
          text: "Pick a default Job Community profile under My account first.",
        },
        true
      );
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    setNeedsKey(false);
    setAlertOpen(false);
    try {
      const result = await integrationsApi.createBidLog({
        profile_id: profileId,
        archive_id: id,
        job_url: jobUrl?.trim() || undefined,
      });

      const warningText = integrationsApi.formatWarnings(result.warnings);
      if (result.confirmed_warnings && warningText) {
        showAlert({
          tone: "warn",
          text: `${result.message} ${warningText}`.trim(),
        });
      } else {
        setFeedback({
          tone: "ok",
          text: result.message || "Bid log created successfully.",
        });
        setAlertOpen(false);
      }
    } catch (err) {
      if (isIntegrationKeyMissingError(err)) {
        showAlert(
          {
            tone: "err",
            text: getApiErrorMessage(err, "Integration key is missing or invalid."),
          },
          true
        );
      } else if (err instanceof ApiError && err.status === 400) {
        showAlert({
          tone: "err",
          text: getApiErrorMessage(err, "Could not create bid log."),
        });
      } else {
        showAlert({
          tone: "err",
          text: getApiErrorMessage(err, "Could not create bid log."),
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const alertTitle =
    feedback?.tone === "warn" ? "Bid log warning" : "Could not add bid log";
  const showAccountLink =
    needsKey || Boolean(feedback?.text.toLowerCase().includes("my account"));

  return (
    <>
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
        {showInlineFeedback && feedback?.tone === "ok" ? (
          <p className="max-w-xs text-xs font-medium text-emerald-700 dark:text-emerald-300" role="status">
            {feedback.text}
          </p>
        ) : null}
      </div>

      <Modal
        open={alertOpen && Boolean(feedback) && feedback?.tone !== "ok"}
        onClose={dismissAlert}
        title={alertTitle}
        className="max-w-md"
        priority
      >
        <div className="space-y-4 px-6 py-5">
          <p
            className={`text-sm leading-relaxed ${
              feedback?.tone === "warn"
                ? "text-amber-800 dark:text-amber-200"
                : "text-slate-700 dark:text-slate-200"
            }`}
            role="alert"
          >
            {feedback?.text}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {showAccountLink ? (
              <Link
                href={integrationSettingsHref()}
                onClick={dismissAlert}
                className="mr-auto text-sm font-semibold text-orange-700 underline-offset-2 hover:underline dark:text-orange-300"
              >
                Open My account
              </Link>
            ) : null}
            <Button type="button" size="sm" onClick={dismissAlert}>
              OK
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
