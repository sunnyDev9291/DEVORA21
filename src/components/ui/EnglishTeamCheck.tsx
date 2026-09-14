"use client";

import { useEffect, useRef, useState } from "react";
import {
  checkEnglishTeam,
  type EnglishTeamCheckResult,
} from "@/lib/english-team-api";

type EnglishTeamCheckProps = {
  jobTitle: string;
  jobDescription: string;
  disabled?: boolean;
};

export default function EnglishTeamCheck({
  jobTitle,
  jobDescription,
  disabled = false,
}: EnglishTeamCheckProps) {
  const abortRef = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<EnglishTeamCheckResult | null>(null);

  const canCheck = Boolean(jobTitle.trim() || jobDescription.trim());

  useEffect(() => {
    // Stale Yes/No must not stick after the job text changes.
    setResult(null);
    setError("");
    abortRef.current?.abort();
    setLoading(false);
  }, [jobTitle, jobDescription]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function handleCheck() {
    if (!canCheck || disabled || loading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await checkEnglishTeam(
        {
          jobTitle: jobTitle.trim(),
          jobDescription: jobDescription.trim(),
        },
        controller.signal
      );
      if (controller.signal.aborted) return;
      setResult(data);
    } catch (err) {
      if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
        return;
      }
      setResult(null);
      setError(err instanceof Error ? err.message : "English-team check failed.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  if (!canCheck) return null;

  const answer = result?.answer;
  const yes = answer === "Yes";
  const no = answer === "No";

  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]"
      aria-live="polite"
      aria-busy={loading}
    >
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
        Work with English team?
      </span>

      <button
        type="button"
        onClick={() => void handleCheck()}
        disabled={disabled || loading || !canCheck}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-sm font-semibold text-orange-800 transition-colors hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-orange-300 dark:hover:bg-orange-500/15"
      >
        {loading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
            Checking…
          </>
        ) : (
          "Check"
        )}
      </button>

      {!loading && yes ? (
        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-sm font-bold text-emerald-800 ring-1 ring-emerald-500/25 dark:text-emerald-300">
          Yes
        </span>
      ) : null}

      {!loading && no ? (
        <span className="inline-flex items-center rounded-full bg-slate-500/15 px-2.5 py-0.5 text-sm font-bold text-slate-700 ring-1 ring-slate-500/20 dark:text-slate-300">
          No
        </span>
      ) : null}

      {!loading && error ? (
        <span className="text-sm text-red-600 dark:text-red-300">{error}</span>
      ) : null}
    </div>
  );
}
