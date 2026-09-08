"use client";

import ClockHands from "./ClockHands";
import ClockMarkers from "./ClockMarkers";
import GlassReflection from "./GlassReflection";
import { useRealTime } from "./useRealTime";
import WatchComplications from "./WatchComplications";
import type { WatchFaceProps } from "./watch-types";

export default function ClockFace({
  variant = "cool",
  todayCount,
  profileLabel,
  generateDigital,
}: WatchFaceProps) {
  const time = useRealTime();
  const warm = variant === "warm";

  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-[28px] shadow-[inset_0_0_40px_rgba(0,0,0,0.65)] ${
        warm ? "bg-[#1a100c]" : "bg-[#030712]"
      }`}
    >
      <div
        className={`absolute inset-0 z-0 ${
          warm
            ? "bg-[radial-gradient(circle_at_30%_25%,rgba(194,65,12,0.28),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(41,24,16,0.95),#1a100c)]"
            : "bg-[radial-gradient(circle_at_30%_25%,rgba(30,58,138,0.22),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(15,23,42,0.9),#030712)]"
        }`}
      />

      <ClockMarkers />
      <WatchComplications
        time={time}
        todayCount={todayCount}
        profileLabel={profileLabel}
        generateDigital={generateDigital}
        variant={variant}
      />
      <ClockHands time={time} variant={variant} />
      <GlassReflection variant={variant} />
    </div>
  );
}
