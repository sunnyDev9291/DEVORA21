"use client";

import { useEffect, useState } from "react";

type AnalogWatchProps = {
  /** Pixel size of the watch face (outer diameter). */
  size?: number;
  className?: string;
  /** Show a thin second hand. */
  showSeconds?: boolean;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Analog watch face for the current local time (not a digital/number clock).
 */
export default function AnalogWatch({
  size = 56,
  className = "",
  showSeconds = true,
}: AnalogWatchProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let frame = 0;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      setNow(new Date());
      frame = window.setTimeout(tick, 250);
    };

    frame = window.setTimeout(tick, 250);
    return () => {
      alive = false;
      window.clearTimeout(frame);
    };
  }, []);

  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const millis = now.getMilliseconds();

  const secondDeg = (seconds + millis / 1000) * 6;
  const minuteDeg = (minutes + seconds / 60) * 6;
  const hourDeg = (hours + minutes / 60) * 30;

  const label = `${pad(now.getHours())}:${pad(minutes)}:${pad(seconds)}`;
  const cx = 50;
  const cy = 50;

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Current time ${label}`}
      title={label}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-md" aria-hidden>
        <defs>
          <radialGradient id="watchFace" cx="42%" cy="38%" r="65%">
            <stop offset="0%" stopColor="#fffdf8" />
            <stop offset="55%" stopColor="#f4efe6" />
            <stop offset="100%" stopColor="#e4dccf" />
          </radialGradient>
          <linearGradient id="watchBezel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#dbeafe" />
            <stop offset="45%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <filter id="watchInnerShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.2" stdDeviation="1.4" floodColor="#0f172a" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* Bezel */}
        <circle cx={cx} cy={cy} r="48.5" fill="url(#watchBezel)" />
        <circle cx={cx} cy={cy} r="44.5" fill="#0f172a" opacity="0.12" />

        {/* Face */}
        <circle
          cx={cx}
          cy={cy}
          r="42"
          fill="url(#watchFace)"
          filter="url(#watchInnerShadow)"
          stroke="#cbd5e1"
          strokeWidth="0.6"
        />

        {/* Minute ticks */}
        {Array.from({ length: 60 }, (_, i) => {
          const isHour = i % 5 === 0;
          const angle = (i * 6 * Math.PI) / 180;
          const outer = 40;
          const inner = isHour ? 33.5 : 37.5;
          const x1 = cx + Math.sin(angle) * outer;
          const y1 = cy - Math.cos(angle) * outer;
          const x2 = cx + Math.sin(angle) * inner;
          const y2 = cy - Math.cos(angle) * inner;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isHour ? "#0f172a" : "#94a3b8"}
              strokeWidth={isHour ? 1.8 : 0.7}
              strokeLinecap="round"
            />
          );
        })}

        {/* Brand pip */}
        <circle cx={cx} cy="22" r="1.4" fill="#2563eb" />

        {/* Hour hand */}
        <g transform={`rotate(${hourDeg} ${cx} ${cy})`}>
          <line
            x1={cx}
            y1={cy + 4}
            x2={cx}
            y2={cy - 22}
            stroke="#0f172a"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </g>

        {/* Minute hand */}
        <g transform={`rotate(${minuteDeg} ${cx} ${cy})`}>
          <line
            x1={cx}
            y1={cy + 5}
            x2={cx}
            y2={cy - 30}
            stroke="#1e293b"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>

        {/* Second hand */}
        {showSeconds ? (
          <g transform={`rotate(${secondDeg} ${cx} ${cy})`}>
            <line
              x1={cx}
              y1={cy + 8}
              x2={cx}
              y2={cy - 34}
              stroke="#2563eb"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy - 26} r="1.6" fill="#2563eb" />
          </g>
        ) : null}

        {/* Hub */}
        <circle cx={cx} cy={cy} r="3.2" fill="#0f172a" />
        <circle cx={cx} cy={cy} r="1.4" fill="#93c5fd" />
      </svg>
    </div>
  );
}
