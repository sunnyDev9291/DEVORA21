"use client";

import ClockFace from "./ClockFace";
import type { WatchFaceProps } from "./watch-types";

type WatchBodyProps = WatchFaceProps & {
  /** Full-page demo vs compact resume overlay. */
  size?: "page" | "panel";
};

export default function WatchBody({
  size = "page",
  variant = "cool",
  todayCount,
  profileLabel,
  generateDigital,
}: WatchBodyProps) {
  const warm = variant === "warm";
  const panel = size === "panel";

  return (
    <div
      className={`relative flex flex-col items-center ${
        panel ? "w-[168px]" : "w-[min(92vw,280px)]"
      }`}
    >
      <div className="relative w-full">
        <div
          className={`absolute -right-1 top-[38%] z-20 rounded-r-md shadow-[2px_0_8px_rgba(0,0,0,0.35)] ring-1 ring-white/10 ${
            panel ? "h-8 w-2.5" : "h-10 w-3"
          } ${
            warm
              ? "bg-gradient-to-r from-stone-700 to-amber-700/80"
              : "bg-gradient-to-r from-slate-700 to-slate-500"
          }`}
          aria-hidden="true"
        />

        <div
          className={`relative rounded-[36px] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ${
            panel ? "rounded-[30px] p-2.5" : ""
          } ${
            warm
              ? "bg-gradient-to-br from-[#3b2a1c] via-[#24180f] to-[#140e09] ring-orange-500/25"
              : "bg-gradient-to-br from-[#1a2238] via-[#0d1224] to-[#060912] ring-slate-600/40"
          }`}
        >
          <div
            className={`absolute inset-[6px] rounded-[32px] ring-1 ring-white/[0.06] ${
              panel ? "inset-[5px] rounded-[26px]" : ""
            }`}
            aria-hidden="true"
          />
          <div
            className={`absolute inset-[10px] rounded-[30px] bg-gradient-to-br to-transparent ${
              panel ? "inset-[8px] rounded-[24px]" : ""
            } ${warm ? "from-orange-400/10" : "from-slate-500/10"}`}
            aria-hidden="true"
          />
          <ClockFace
            variant={variant}
            todayCount={todayCount}
            profileLabel={profileLabel}
            generateDigital={generateDigital}
          />
        </div>
      </div>

      {!panel ? (
        <div className="relative -mt-1 flex w-[72%] flex-col items-center" aria-hidden="true">
          <div
            className={`h-5 w-full rounded-b-[18px] ring-1 ${
              warm
                ? "bg-gradient-to-b from-[#24180f] to-[#140e09] ring-orange-900/40"
                : "bg-gradient-to-b from-[#111827] to-[#0b1020] ring-slate-700/50"
            }`}
          />
          <div
            className={`h-24 w-full rounded-b-[28px] shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)] ring-1 ${
              warm
                ? "bg-gradient-to-b from-[#1c130c] via-[#24180f] to-[#3b2a1c] ring-orange-900/35"
                : "bg-gradient-to-b from-[#0f172a] via-[#111827] to-[#1e293b] ring-slate-700/40"
            }`}
          />
          <div className="absolute bottom-2 h-3 w-[88%] rounded-full bg-black/25 blur-md" />
        </div>
      ) : (
        <div
          className={`-mt-0.5 h-6 w-[78%] rounded-b-2xl ring-1 ${
            warm
              ? "bg-gradient-to-b from-[#1c130c] to-[#3b2a1c] ring-orange-900/35"
              : "bg-gradient-to-b from-[#0f172a] to-[#1e293b] ring-slate-700/40"
          }`}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
