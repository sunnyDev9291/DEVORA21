"use client";

import { useEffect, useId, useState } from "react";
import { useTodaysResumeCount } from "@/hooks/useTodaysResumeCount";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

/**
 * Large always-on smartwatch UI showing current local time with analog hands
 * (not a digital number clock). Includes today's resume count as a complication.
 */
export default function SmartWatchPanel({
  className = "",
}: {
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const [now, setNow] = useState(() => new Date());
  const { count, loading } = useTodaysResumeCount(true);
  const todayCount = loading && count == null ? null : count ?? 0;

  useEffect(() => {
    let timer = 0;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      setNow(new Date());
      timer = window.setTimeout(tick, 200);
    };
    timer = window.setTimeout(tick, 200);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);

  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const millis = now.getMilliseconds();
  const secondDeg = (seconds + millis / 1000) * 6;
  const minuteDeg = (minutes + seconds / 60) * 6;
  const hourDeg = (hours + minutes / 60) * 30;
  const weekday = WEEKDAYS[now.getDay()];
  const dayNum = now.getDate();

  const faceId = `sw-face-${uid}`;
  const bezelId = `sw-bezel-${uid}`;
  const glowId = `sw-glow-${uid}`;
  const bandId = `sw-band-${uid}`;

  return (
    <aside
      className={`pointer-events-none fixed bottom-6 left-4 z-[90] sm:bottom-8 sm:left-6 ${className}`}
      aria-label={`Current time. ${todayCount == null ? "Loading" : todayCount} resumes made today.`}
    >
      <div className="pointer-events-auto flex flex-col items-center">
        {/* Top band stub */}
        <div
          className="h-7 w-[118px] rounded-t-2xl sm:h-8 sm:w-[138px]"
          style={{ background: `linear-gradient(180deg, #1e293b, #0f172a)` }}
          aria-hidden
        />

        {/* Case */}
        <div className="relative rounded-[2rem] border border-slate-500/40 bg-gradient-to-br from-slate-700 via-slate-900 to-black p-[10px] shadow-[0_20px_50px_rgba(15,23,42,0.55)] sm:rounded-[2.35rem] sm:p-[12px]">
          {/* Crown */}
          <div
            className="absolute -right-[7px] top-[42%] h-10 w-[7px] rounded-r-md bg-gradient-to-b from-slate-400 via-slate-500 to-slate-700 shadow-sm sm:h-12 sm:w-[8px]"
            aria-hidden
          />
          {/* Side button */}
          <div
            className="absolute -right-[5px] top-[58%] h-6 w-[5px] rounded-r-sm bg-slate-600 sm:h-7"
            aria-hidden
          />

          <div className="relative h-[168px] w-[146px] overflow-hidden rounded-[1.55rem] bg-slate-950 ring-1 ring-white/10 sm:h-[196px] sm:w-[170px] sm:rounded-[1.85rem]">
            <svg viewBox="0 0 100 116" className="h-full w-full" aria-hidden>
              <defs>
                <radialGradient id={faceId} cx="40%" cy="32%" r="70%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="55%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#020617" />
                </radialGradient>
                <linearGradient id={bezelId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#93c5fd" />
                  <stop offset="40%" stopColor="#334155" />
                  <stop offset="100%" stopColor="#020617" />
                </linearGradient>
                <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={bandId} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#334155" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
              </defs>

              {/* Soft blue ambient */}
              <ellipse cx="50" cy="54" rx="38" ry="38" fill={`url(#${glowId})`} />

              {/* Round dial */}
              <circle cx="50" cy="54" r="40" fill={`url(#${bezelId})`} opacity="0.55" />
              <circle cx="50" cy="54" r="37.5" fill={`url(#${faceId})`} stroke="#475569" strokeWidth="0.5" />

              {/* Ticks */}
              {Array.from({ length: 60 }, (_, i) => {
                const isHour = i % 5 === 0;
                const angle = (i * 6 * Math.PI) / 180;
                const outer = 35.5;
                const inner = isHour ? 29.5 : 33.2;
                return (
                  <line
                    key={i}
                    x1={50 + Math.sin(angle) * outer}
                    y1={54 - Math.cos(angle) * outer}
                    x2={50 + Math.sin(angle) * inner}
                    y2={54 - Math.cos(angle) * inner}
                    stroke={isHour ? "#e2e8f0" : "#64748b"}
                    strokeWidth={isHour ? 1.6 : 0.6}
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Date complication (not time digits) */}
              <rect x="62" y="48" width="14" height="11" rx="2" fill="#020617" stroke="#475569" strokeWidth="0.5" />
              <text
                x="69"
                y="56.2"
                textAnchor="middle"
                fill="#93c5fd"
                fontSize="5.5"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight="700"
              >
                {dayNum}
              </text>

              {/* Weekday pip */}
              <text
                x="50"
                y="28"
                textAnchor="middle"
                fill="#60a5fa"
                fontSize="4.2"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight="700"
                letterSpacing="1.2"
              >
                {weekday}
              </text>

              {/* Hands */}
              <g transform={`rotate(${hourDeg} 50 54)`}>
                <line x1="50" y1="58" x2="50" y2="36" stroke="#f8fafc" strokeWidth="2.8" strokeLinecap="round" />
              </g>
              <g transform={`rotate(${minuteDeg} 50 54)`}>
                <line x1="50" y1="60" x2="50" y2="28" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
              </g>
              <g transform={`rotate(${secondDeg} 50 54)`}>
                <line x1="50" y1="62" x2="50" y2="25" stroke="#3b82f6" strokeWidth="1" strokeLinecap="round" />
                <circle cx="50" cy="30" r="1.3" fill="#60a5fa" />
              </g>
              <circle cx="50" cy="54" r="2.8" fill="#f8fafc" />
              <circle cx="50" cy="54" r="1.2" fill="#3b82f6" />

              {/* Bottom complication: today resume count */}
              <text
                x="50"
                y="98"
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="3.6"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight="600"
                letterSpacing="0.8"
              >
                TODAY
              </text>
              <text
                x="50"
                y="108"
                textAnchor="middle"
                fill="#f8fafc"
                fontSize="7"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight="700"
              >
                {todayCount == null ? "…" : todayCount}
              </text>
            </svg>
          </div>
        </div>

        {/* Bottom band stub */}
        <div
          className="h-7 w-[118px] rounded-b-2xl sm:h-8 sm:w-[138px]"
          style={{ background: `linear-gradient(180deg, #0f172a, #1e293b)` }}
          aria-hidden
        />
      </div>
    </aside>
  );
}
