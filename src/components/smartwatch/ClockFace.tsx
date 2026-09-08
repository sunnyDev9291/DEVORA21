"use client";

import Image from "next/image";
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
      className={`relative aspect-square w-full overflow-hidden rounded-[28px] shadow-[inset_0_0_40px_rgba(0,0,0,0.55)] ${
        warm ? "bg-[#1a100c]" : "bg-[#030712]"
      }`}
    >
      <Image
        src="/images/watch-nature-dial.webp"
        alt=""
        fill
        sizes="180px"
        quality={70}
        priority={false}
        loading="lazy"
        className="object-cover object-center"
        aria-hidden="true"
      />

      <div
        className={`absolute inset-0 z-[1] ${
          warm
            ? "bg-[radial-gradient(circle_at_50%_40%,rgba(26,16,12,0.28),rgba(26,16,12,0.72)_72%),linear-gradient(180deg,rgba(67,20,7,0.22),rgba(26,16,12,0.55))]"
            : "bg-[radial-gradient(circle_at_50%_40%,rgba(3,7,18,0.22),rgba(3,7,18,0.7)_72%),linear-gradient(180deg,rgba(15,23,42,0.28),rgba(2,6,23,0.58))]"
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
      <ClockHands variant={variant} />
      <GlassReflection variant={variant} />
    </div>
  );
}
