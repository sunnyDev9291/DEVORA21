"use client";

import ClockFace from "./ClockFace";

export default function WatchBody() {
  return (
    <div className="relative flex w-[min(92vw,280px)] flex-col items-center">
      <div className="relative w-full">
        <div
          className="absolute -right-1 top-[38%] z-20 h-10 w-3 rounded-r-md bg-gradient-to-r from-slate-700 to-slate-500 shadow-[2px_0_8px_rgba(0,0,0,0.35)] ring-1 ring-white/10"
          aria-hidden="true"
        />

        <div className="relative rounded-[36px] bg-gradient-to-br from-[#1a2238] via-[#0d1224] to-[#060912] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-slate-600/40">
          <div className="absolute inset-[6px] rounded-[32px] ring-1 ring-white/[0.06]" aria-hidden="true" />
          <div className="absolute inset-[10px] rounded-[30px] bg-gradient-to-br from-slate-500/10 to-transparent" aria-hidden="true" />
          <ClockFace />
        </div>
      </div>

      <div className="relative -mt-1 flex w-[72%] flex-col items-center" aria-hidden="true">
        <div className="h-5 w-full rounded-b-[18px] bg-gradient-to-b from-[#111827] to-[#0b1020] ring-1 ring-slate-700/50" />
        <div className="h-24 w-full rounded-b-[28px] bg-gradient-to-b from-[#0f172a] via-[#111827] to-[#1e293b] shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)] ring-1 ring-slate-700/40" />
        <div className="absolute bottom-2 h-3 w-[88%] rounded-full bg-black/25 blur-md" />
      </div>
    </div>
  );
}
