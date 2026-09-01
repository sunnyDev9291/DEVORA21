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

export function useRealTime(): RealTimeState {
  const [time, setTime] = useState<RealTimeState>(() => readTime());

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setTime(readTime());
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return time;
}

function readTime(): RealTimeState {
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
