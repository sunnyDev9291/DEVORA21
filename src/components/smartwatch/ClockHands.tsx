"use client";

import { useEffect, useRef } from "react";
import type { WatchVariant } from "./watch-types";

type ClockHandsProps = {
  variant?: WatchVariant;
};

/**
 * Smooth analog hands via rAF + DOM transforms (no React re-render per frame).
 */
export default function ClockHands({ variant = "cool" }: ClockHandsProps) {
  const hourRef = useRef<SVGLineElement>(null);
  const minuteRef = useRef<SVGLineElement>(null);
  const secondRef = useRef<SVGLineElement>(null);
  const warm = variant === "warm";
  const secondStroke = warm ? "#fb923c" : "#38bdf8";
  const hubFill = warm ? "#f97316" : "#38bdf8";

  useEffect(() => {
    let frame = 0;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      if (document.visibilityState !== "hidden") {
        const now = new Date();
        const ms = now.getMilliseconds();
        const seconds = now.getSeconds() + ms / 1000;
        const minutes = now.getMinutes() + seconds / 60;
        const hours = (now.getHours() % 12) + minutes / 60;
        hourRef.current?.setAttribute("transform", `rotate(${hours * 30})`);
        minuteRef.current?.setAttribute("transform", `rotate(${minutes * 6})`);
        secondRef.current?.setAttribute("transform", `rotate(${seconds * 6})`);
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => {
      alive = false;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
      <svg viewBox="0 0 200 200" className="h-full w-full">
        <g transform="translate(100 100)">
          <line
            ref={hourRef}
            x1={0}
            y1={0}
            x2={0}
            y2={-46}
            stroke="#f8fafc"
            strokeWidth={3.2}
            strokeLinecap="round"
            opacity={0.95}
          />
          <line
            ref={minuteRef}
            x1={0}
            y1={0}
            x2={0}
            y2={-62}
            stroke="#f1f5f9"
            strokeWidth={2.2}
            strokeLinecap="round"
            opacity={0.98}
          />
          <line
            ref={secondRef}
            x1={0}
            y1={8}
            x2={0}
            y2={-68}
            stroke={secondStroke}
            strokeWidth={1.2}
            strokeLinecap="round"
            opacity={0.95}
          />
          <circle r={3.2} fill="#e2e8f0" />
          <circle r={1.4} fill={hubFill} />
        </g>
      </svg>
    </div>
  );
}
