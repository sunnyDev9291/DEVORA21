"use client";

import type { RealTimeState } from "./useRealTime";

type ClockHandsProps = {
  time: RealTimeState;
};

export default function ClockHands({ time }: ClockHandsProps) {
  const secondAngle = ((time.seconds + time.milliseconds / 1000) / 60) * 360;
  const minuteAngle = ((time.minutes + time.seconds / 60) / 60) * 360;
  const hourAngle = (((time.hours % 12) + time.minutes / 60) / 12) * 360;

  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
      <svg viewBox="0 0 200 200" className="h-full w-full">
        <g transform="translate(100 100)">
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={-46}
            stroke="#f8fafc"
            strokeWidth={3.2}
            strokeLinecap="round"
            transform={`rotate(${hourAngle})`}
            opacity={0.95}
          />
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={-62}
            stroke="#f1f5f9"
            strokeWidth={2.2}
            strokeLinecap="round"
            transform={`rotate(${minuteAngle})`}
            opacity={0.98}
          />
          <line
            x1={0}
            y1={8}
            x2={0}
            y2={-68}
            stroke="#38bdf8"
            strokeWidth={1.2}
            strokeLinecap="round"
            transform={`rotate(${secondAngle})`}
            opacity={0.95}
          />
          <circle r={3.2} fill="#e2e8f0" />
          <circle r={1.4} fill="#38bdf8" />
        </g>
      </svg>
    </div>
  );
}
