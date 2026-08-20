"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchTodaysResumeCount,
  TODAYS_RESUME_COUNT_CHANGED_EVENT,
} from "@/lib/todays-resume-count";

export function useTodaysResumeCount(enabled = true) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(null);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const next = await fetchTodaysResumeCount();
      setCount(next);
    } catch (err) {
      setCount(null);
      setError((err as Error).message || "Could not load today's resume count.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    function onChanged() {
      void refresh();
    }

    function onVisible() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }

    window.addEventListener(TODAYS_RESUME_COUNT_CHANGED_EVENT, onChanged);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(TODAYS_RESUME_COUNT_CHANGED_EVENT, onChanged);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, refresh]);

  return { count, loading, error, refresh };
}
