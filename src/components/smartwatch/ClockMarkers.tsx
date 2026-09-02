"use client";

const NUMBERS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

export default function ClockMarkers() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
      <svg viewBox="0 0 200 200" className="h-full w-full">
        {Array.from({ length: 60 }, (_, index) => {
          const angle = (index / 60) * 360 - 90;
          const rad = (angle * Math.PI) / 180;
          const isMajor = index % 5 === 0;
          const inner = isMajor ? 84 : 88;
          const outer = 92;
          const x1 = 100 + Math.cos(rad) * inner;
          const y1 = 100 + Math.sin(rad) * inner;
          const x2 = 100 + Math.cos(rad) * outer;
          const y2 = 100 + Math.sin(rad) * outer;
          return (
            <line
              key={`tick-${index}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isMajor ? "rgba(226,232,240,0.85)" : "rgba(148,163,184,0.45)"}
              strokeWidth={isMajor ? 1.4 : 0.7}
              strokeLinecap="round"
            />
          );
        })}

        {NUMBERS.map((num, index) => {
          const angle = (index / 12) * 360 - 90;
          const rad = (angle * Math.PI) / 180;
          const x = 100 + Math.cos(rad) * 72;
          const y = 100 + Math.sin(rad) * 72;
          return (
            <text
              key={num}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="rgba(248,250,252,0.92)"
              fontSize={num === 12 ? 11 : 10}
              fontWeight={600}
              fontFamily="system-ui, sans-serif"
            >
              {num}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
