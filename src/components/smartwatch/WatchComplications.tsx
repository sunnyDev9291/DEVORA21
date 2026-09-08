"use client";

import type { RealTimeState } from "./useRealTime";
import type { WatchVariant } from "./watch-types";

type WatchComplicationsProps = {
  time: RealTimeState;
  todayCount?: number | null;
  profileLabel?: string;
  generateDigital?: string | null;
  variant?: WatchVariant;
};

export default function WatchComplications({
  time,
  todayCount = 0,
  profileLabel,
  generateDigital,
  variant = "cool",
}: WatchComplicationsProps) {
  const warm = variant === "warm";
  const brand = profileLabel?.trim()
    ? profileLabel.trim().toUpperCase()
    : warm
      ? "DEVORA"
      : "FRANCO";
  const countLabel = todayCount == null ? "…" : String(todayCount);

  return (
    <div className="pointer-events-none absolute inset-0 z-[25] text-[10px] font-semibold tracking-[0.18em] text-slate-100">
      {generateDigital ? (
        <div
          className={`absolute left-1/2 top-[3.5%] -translate-x-1/2 font-mono text-[10px] font-bold tracking-[0.16em] ${
            warm ? "text-emerald-400" : "text-emerald-300"
          }`}
        >
          {generateDigital}
        </div>
      ) : null}

      <div
        className={`absolute left-1/2 -translate-x-1/2 text-[11px] tracking-[0.28em] ${
          generateDigital ? "top-[9%]" : "top-[7%]"
        } ${warm ? "text-orange-200/95" : "text-slate-200/95"}`}
      >
        {brand}
      </div>

      <div
        className={`absolute left-1/2 -translate-x-1/2 text-[9px] tracking-[0.14em] ${
          generateDigital ? "top-[19%]" : "top-[17%]"
        } ${warm ? "text-amber-200/70" : "text-slate-400"}`}
      >
        {time.dayName} {time.dayOfMonth}
      </div>

      <div
        className={`absolute right-[11%] top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[11px] font-bold shadow-inner ring-1 ${
          warm
            ? "bg-[#3b2418]/90 text-orange-50 ring-orange-400/30"
            : "bg-[#0f1f3d]/88 text-slate-100 ring-blue-400/20"
        }`}
      >
        {time.dayOfMonth}
      </div>

      <div className="absolute bottom-[11%] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5">
        <span className={`text-[8px] tracking-[0.22em] ${warm ? "text-amber-200/70" : "text-slate-400"}`}>
          TODAY
        </span>
        <span
          className={`rounded-full px-3 py-0.5 text-[11px] font-bold text-white ${
            warm
              ? "bg-gradient-to-r from-tomato-600 via-orange-500 to-sun-400 shadow-[0_0_12px_rgba(249,115,22,0.4)]"
              : "bg-sky-500/90 shadow-[0_0_12px_rgba(56,189,248,0.35)]"
          }`}
        >
          {countLabel}
        </span>
      </div>
    </div>
  );
}
