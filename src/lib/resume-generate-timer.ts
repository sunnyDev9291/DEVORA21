/** Live or frozen Generate→draft elapsed time for the always-on smartwatch. */

export const RESUME_GENERATE_TIMER_EVENT = "devora21-resume-generate-timer";

export type ResumeGenerateTimerState = {
  /** When true, watch shows HH:MM:SS (live while generating, frozen after finish). */
  active: boolean;
  elapsedMs: number;
};

let state: ResumeGenerateTimerState = { active: false, elapsedMs: 0 };

export function getResumeGenerateTimer(): ResumeGenerateTimerState {
  return state;
}

export function publishResumeGenerateTimer(next: ResumeGenerateTimerState): void {
  state = next;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RESUME_GENERATE_TIMER_EVENT));
}

export function clearResumeGenerateTimer(): void {
  publishResumeGenerateTimer({ active: false, elapsedMs: 0 });
}
