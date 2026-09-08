"use client";

import { useEffect, useState } from "react";

export type RealTimeState = {
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  dayName: string;
  dayOfMonth: number;
  monthName: string;
};

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

/**
 * Second-resolution clock for complications (day label, date window).
 * Smooth hand motion lives in ClockHands via direct DOM updates.
 */
export function useRealTime(): RealTimeState {
  const [time, setTime] = useState<RealTimeState>(() => readTime());

  useEffect(() => {
    let timer = 0;
    let alive = true;

    const sync = () => {
      if (!alive) return;
      setTime(readTime());
      const delay = Math.max(250, 1000 - (Date.now() % 1000));
      timer = window.setTimeout(sync, delay);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timer);
        sync();
      }
    };

    sync();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return time;
}

export function readTime(): RealTimeState {
  const now = new Date();
  return {
    hours: now.getHours(),
    minutes: now.getMinutes(),
    seconds: now.getSeconds(),
    milliseconds: now.getMilliseconds(),
    dayName: DAY_NAMES[now.getDay()],
    dayOfMonth: now.getDate(),
    monthName: now.toLocaleString("en-US", { month: "short" }).toUpperCase(),
  };
}
