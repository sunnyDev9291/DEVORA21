"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "@/hooks/useInView";

interface AnimatedCounterProps {
  value: string;
  label: string;
}

function parseValue(val: string): { number: number; suffix: string; prefix: string } {
  const prefix = val.startsWith("$") ? "$" : "";
  const clean = val.replace(/[$+%k]/gi, "");
  const number = parseFloat(clean) || 0;
  const suffix = val.replace(prefix, "").replace(String(number), "");
  return { number, suffix, prefix };
}

export default function AnimatedCounter({ value, label }: AnimatedCounterProps) {
  const { ref, inView } = useInView();
  const [display, setDisplay] = useState("0");
  const hasRun = useRef(false);

  useEffect(() => {
    if (!inView || hasRun.current) return;
    hasRun.current = true;

    const { number, suffix, prefix } = parseValue(value);
    const duration = 1800;
    const steps = 60;
    const increment = number / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(current + increment, number);
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
      className="text-center"
    >
      <p className="text-4xl sm:text-5xl font-bold text-white mb-1 tracking-tight tabular-nums">
        {inView ? display : "0"}
      </p>
      <p className="text-slate-500 text-sm font-medium">{label}</p>
    </div>
  );
}
