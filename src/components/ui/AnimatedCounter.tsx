"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "@/hooks/useInView";

interface AnimatedCounterProps {
  value: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
}

function parseValue(val: string): { number: number; suffix: string; prefix: string } {
  const prefix = val.startsWith("$") ? "$" : "";
  const clean = val.replace(/[$+%kh]/gi, "");
  const number = parseFloat(clean) || 0;
  const suffix = val.replace(prefix, "").replace(String(number), "");
  return { number, suffix, prefix };
}

export default function AnimatedCounter({ value, label, description, icon, gradient }: AnimatedCounterProps) {
  const { ref, inView } = useInView();
  const [display, setDisplay] = useState("0");
  const hasRun = useRef(false);

  useEffect(() => {
    if (!inView || hasRun.current) return;
    hasRun.current = true;

    const { number, suffix, prefix } = parseValue(value);
    const duration = 1800;
    const steps = 60;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const eased = number * (1 - Math.pow(1 - step / steps, 3));
      const clamped = Math.min(eased, number);
      const formatted = Number.isInteger(number)
        ? Math.round(clamped).toString()
        : clamped.toFixed(1);
      setDisplay(`${prefix}${formatted}${suffix}`);
      if (step >= steps) clearInterval(timer);
    }, duration / steps);

    return () => clearInterval(timer);
  }, [inView, value]);

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className="relative group flex flex-col items-center text-center p-8 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] hover:border-blue-500/40 dark:hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10"
    >
      {/* Subtle glow on hover */}
      <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-300 bg-gradient-to-br ${gradient} blur-2xl -z-10`} />

      {/* Icon badge */}
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-5 shadow-lg`}>
        <div className="text-white w-5 h-5">{icon}</div>
      </div>

      {/* Number */}
      <p className={`text-5xl sm:text-6xl font-black bg-gradient-to-br ${gradient} bg-clip-text text-transparent tabular-nums leading-none mb-2`}>
        {inView ? display : "0"}
      </p>

      {/* Label */}
      <p className="text-slate-900 dark:text-white font-semibold text-base mb-1">{label}</p>

      {/* Description */}
      <p className="text-slate-500 dark:text-slate-500 text-xs leading-relaxed">{description}</p>
    </div>
  );
}
