"use client";

import type { RealTimeState } from "./useRealTime";

type WatchComplicationsProps = {
  time: RealTimeState;
  todayCount?: number;
};

export default function WatchComplications({ time, todayCount = 0 }: WatchComplicationsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[25] text-[10px] font-semibold tracking-[0.18em] text-slate-100">
      <div className="absolute left-1/2 top-[7%] -translate-x-1/2 text-[11px] tracking-[0.28em] text-slate-200/95">
        FRANCO
      </div>

      <div className="absolute left-1/2 top-[17%] -translate-x-1/2 text-[9px] tracking-[0.14em] text-slate-400">
        {time.dayName} {time.dayOfMonth}
      </div>

      <div className="absolute right-[11%] top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-[#0f1f3d]/88 text-[11px] font-bold text-slate-100 shadow-inner ring-1 ring-blue-400/20">
        {time.dayOfMonth}
      </div>

      <div className="absolute bottom-[11%] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5">
        <span className="text-[8px] tracking-[0.22em] text-slate-400">TODAY</span>
        <span className="rounded-full bg-sky-500/90 px-3 py-0.5 text-[11px] font-bold text-white shadow-[0_0_12px_rgba(56,189,248,0.35)]">
          {todayCount}
        </span>
      </div>
    </div>
  );
}
