"use client";

import ClockHands from "./ClockHands";
import ClockMarkers from "./ClockMarkers";
import GlassReflection from "./GlassReflection";
import { useRealTime } from "./useRealTime";
import WatchComplications from "./WatchComplications";

export default function ClockFace() {
  const time = useRealTime();

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-[28px] bg-[#030712] shadow-[inset_0_0_40px_rgba(0,0,0,0.65)]">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_30%_25%,rgba(30,58,138,0.22),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(15,23,42,0.9),#030712)]" />

      <ClockMarkers />
      <WatchComplications time={time} />
      <ClockHands time={time} />
      <GlassReflection />
    </div>
  );
}
