"use client";

export default function GlassReflection() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 overflow-hidden rounded-[28px]"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.14] via-transparent to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-blue-300/[0.04] via-transparent to-sky-200/[0.06]" />
      <div className="absolute left-[8%] top-[6%] h-[34%] w-[42%] rotate-[-18deg] rounded-full bg-white/[0.08] blur-2xl" />
      <div className="absolute inset-[1px] rounded-[27px] ring-1 ring-inset ring-white/10" />
    </div>
  );
}
