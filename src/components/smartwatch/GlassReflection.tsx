"use client";

import type { WatchVariant } from "./watch-types";

type GlassReflectionProps = {
  variant?: WatchVariant;
};

export default function GlassReflection({ variant = "cool" }: GlassReflectionProps) {
  const warm = variant === "warm";

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 overflow-hidden rounded-[28px]"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.14] via-transparent to-transparent" />
      <div
        className={`absolute inset-0 bg-gradient-to-t via-transparent ${
          warm
            ? "from-orange-300/[0.05] to-amber-200/[0.07]"
            : "from-blue-300/[0.04] to-sky-200/[0.06]"
        }`}
      />
      <div className="absolute left-[8%] top-[6%] h-[34%] w-[42%] rotate-[-18deg] rounded-full bg-white/[0.08] blur-2xl" />
      <div className="absolute inset-[1px] rounded-[27px] ring-1 ring-inset ring-white/10" />
    </div>
  );
}
