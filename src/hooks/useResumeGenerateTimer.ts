"use client";

import { useEffect, useState } from "react";
import {
  getResumeGenerateTimer,
  RESUME_GENERATE_TIMER_EVENT,
  type ResumeGenerateTimerState,
} from "@/lib/resume-generate-timer";

/** Subscribe to live resume-generate elapsed time (for the smartwatch). */
export function useResumeGenerateTimer(): ResumeGenerateTimerState {
  const [timer, setTimer] = useState<ResumeGenerateTimerState>(() => getResumeGenerateTimer());

  useEffect(() => {
    function sync() {
      setTimer(getResumeGenerateTimer());
    }
    sync();
    window.addEventListener(RESUME_GENERATE_TIMER_EVENT, sync);
    return () => window.removeEventListener(RESUME_GENERATE_TIMER_EVENT, sync);
  }, []);

  return timer;
}
