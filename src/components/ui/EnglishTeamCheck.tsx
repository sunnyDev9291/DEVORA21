"use client";

import { useEffect, useRef, useState } from "react";
import {
  checkEnglishTeam,
  type EnglishTeamCheckResult,
} from "@/lib/english-team-api";

const DEBOUNCE_MS = 700;

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
  const requestIdRef = useRef(0);
  const [query, setQuery] = useState<{ jobTitle: string; jobDescription: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<EnglishTeamCheckResult | null>(null);

  useEffect(() => {
    const nextTitle = jobTitle.trim();
    const nextDescription = jobDescription.trim();
    if (!nextTitle && !nextDescription) {
      setQuery(null);
      setResult(null);
      setError("");
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setQuery({ jobTitle: nextTitle, jobDescription: nextDescription });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [jobTitle, jobDescription]);

  useEffect(() => {
    if (!query || disabled) {
      if (!query) {
        setResult(null);
        setError("");
        setLoading(false);
      }
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    setLoading(true);
    setError("");

    void checkEnglishTeam(query, controller.signal)
      .then((data) => {
        if (requestId !== requestIdRef.current) return;
        setResult(data);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        setResult(null);
        setError(err instanceof Error ? err.message : "English-team check failed.");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [query, disabled]);

  if (!jobTitle.trim() && !jobDescription.trim()) return null;

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

      {loading ? (
        <span className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          Checking…
        </span>
      ) : null}

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
