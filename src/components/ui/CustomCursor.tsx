"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CursorMode = "default" | "pointer";

type ClickRipple = {
  id: number;
  x: number;
  y: number;
};

type WakeRipple = {
  id: number;
  x: number;
  y: number;
  angle: number;
};

const POINTER_SELECTOR =
  'a, button, summary, [role="button"], [role="link"], input:not([type="hidden"]), select, textarea, label[for], [data-cursor="pointer"], .cursor-pointer';

const LERP_CURSOR = 0.22;
const CLICK_RIPPLE_DURATION_MS = 920;
const WAKE_RIPPLE_DURATION_MS = 1300;
const MAX_CLICK_RIPPLES = 8;
const MAX_WAKE_RIPPLES = 16;
const WAKE_SPAWN_DISTANCE = 14;

const CLICK_RIPPLE_RINGS = [
  { radius: 16, dash: "3 7", width: 2.8, delay: 0 },
  { radius: 26, dash: "5 9", width: 2.4, delay: 0.04 },
  { radius: 36, dash: "7 11", width: 2.1, delay: 0.08 },
  { radius: 48, dash: "9 13", width: 1.8, delay: 0.12 },
  { radius: 60, dash: "11 15", width: 1.5, delay: 0.16 },
  { radius: 72, dash: "13 17", width: 1.2, delay: 0.2 },
] as const;

const WAKE_RIPPLE_RINGS = [
  { radius: 10, dash: "4 10", width: 1.8, delay: 0 },
  { radius: 18, dash: "6 12", width: 1.5, delay: 0.06 },
  { radius: 28, dash: "8 14", width: 1.2, delay: 0.12 },
] as const;

const CLICK_RIPPLE_PARTICLES = [
  { angle: 12, distance: 34, size: 2.2, delay: 0.02 },
  { angle: 48, distance: 42, size: 1.6, delay: 0.08 },
  { angle: 92, distance: 38, size: 2, delay: 0.05 },
  { angle: 138, distance: 46, size: 1.4, delay: 0.12 },
  { angle: 184, distance: 36, size: 2.4, delay: 0.03 },
  { angle: 226, distance: 44, size: 1.5, delay: 0.1 },
  { angle: 272, distance: 40, size: 1.8, delay: 0.07 },
  { angle: 318, distance: 48, size: 1.3, delay: 0.14 },
] as const;

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function NeonGlowDefs() {
  return (
    <defs>
      <filter id="neon-cursor-glow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="0 0 0 0 0.22
                  0 0 0 0 0.74
                  0 0 0 0 0.98
                  0 0 0 0.9 0"
          result="glow"
        />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

function NeonArrowCursor() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="neon-cursor-icon"
      aria-hidden="true"
    >
      <NeonGlowDefs />
      <path
        d="M4.5 3.5L4.5 19.5L9.5 14.5L13.5 23.5L16.5 21.5L12.5 12.5H20.5L4.5 3.5Z"
        fill="rgba(125, 211, 252, 0.28)"
        stroke="#E0F2FE"
        strokeWidth="1.6"
        strokeLinejoin="round"
        filter="url(#neon-cursor-glow)"
      />
    </svg>
  );
}

function NeonHandCursor() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="neon-cursor-icon"
      aria-hidden="true"
    >
      <NeonGlowDefs />
      <path
        d="M10 12.5V8.25C10 7.007 11.007 6 12.25 6C13.493 6 14.5 7.007 14.5 8.25V12.5M14.5 12.5V6.75C14.5 5.507 15.507 4.5 16.75 4.5C17.993 4.5 19 5.507 19 6.75V13.25C19 17.807 15.307 21.5 10.75 21.5H9.75C6.574 21.5 4 18.926 4 15.75V14.25C4 13.007 5.007 12 6.25 12C7.493 12 8.5 13.007 8.5 14.25V12.5H10"
        stroke="#E0F2FE"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="rgba(125, 211, 252, 0.22)"
        filter="url(#neon-cursor-glow)"
      />
    </svg>
  );
}

function ClickRippleBurst({ id, x, y, onDone }: { id: number; x: number; y: number; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, CLICK_RIPPLE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  const glowId = `neon-cursor-click-glow-${id}`;

  return (
    <div className="neon-cursor-ripple neon-cursor-ripple--click" style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}>
      <svg viewBox="-90 -90 180 180" className="neon-cursor-ripple-svg neon-cursor-ripple-svg--click" aria-hidden="true">
        <defs>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.42)" />
            <stop offset="55%" stopColor="rgba(37, 99, 235, 0.16)" />
            <stop offset="100%" stopColor="rgba(37, 99, 235, 0)" />
          </radialGradient>
        </defs>

        <circle r="34" fill={`url(#${glowId})`} className="neon-cursor-ripple-glow" />

        {CLICK_RIPPLE_RINGS.map((ring, index) => (
          <g
            key={ring.radius}
            className="neon-cursor-ripple-ring"
            style={{ animationDelay: `${ring.delay}s` }}
          >
            <circle
              r={ring.radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={ring.width}
              strokeDasharray={ring.dash}
              strokeLinecap="round"
              className={index % 2 === 0 ? "neon-cursor-ripple-ring-inner" : "neon-cursor-ripple-ring-outer"}
            />
          </g>
        ))}

        {CLICK_RIPPLE_PARTICLES.map((particle) => {
          const radians = (particle.angle * Math.PI) / 180;
          const px = Math.cos(radians) * particle.distance;
          const py = Math.sin(radians) * particle.distance;

          return (
            <circle
              key={`${particle.angle}-${particle.distance}`}
              cx={px}
              cy={py}
              r={particle.size}
              className="neon-cursor-ripple-particle"
              style={{ animationDelay: `${particle.delay}s` }}
            />
          );
        })}
      </svg>
    </div>
  );
}

function WakeRippleRing({ id, x, y, angle, onDone }: { id: number; x: number; y: number; angle: number; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, WAKE_RIPPLE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  const glowId = `neon-cursor-wake-glow-${id}`;

  return (
    <div
      className="neon-cursor-ripple neon-cursor-ripple--wake"
      style={{ transform: `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg)` }}
    >
      <svg viewBox="-60 -60 120 120" className="neon-cursor-ripple-svg neon-cursor-ripple-svg--wake" aria-hidden="true">
        <defs>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(125, 211, 252, 0.28)" />
            <stop offset="60%" stopColor="rgba(56, 189, 248, 0.1)" />
            <stop offset="100%" stopColor="rgba(56, 189, 248, 0)" />
          </radialGradient>
        </defs>

        <ellipse rx="22" ry="14" fill={`url(#${glowId})`} className="neon-cursor-wake-glow" />

        {WAKE_RIPPLE_RINGS.map((ring, index) => (
          <g
            key={ring.radius}
            className="neon-cursor-wake-ring"
            style={{ animationDelay: `${ring.delay}s` }}
          >
            <ellipse
              rx={ring.radius}
              ry={ring.radius * 0.62}
              fill="none"
              stroke="currentColor"
              strokeWidth={ring.width}
              strokeDasharray={ring.dash}
              strokeLinecap="round"
              className={index % 2 === 0 ? "neon-cursor-wake-ring-inner" : "neon-cursor-wake-ring-outer"}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

function ShipWakeChevron({ x, y, angle, speed, visible }: { x: number; y: number; angle: number; speed: number; visible: boolean }) {
  const intensity = Math.min(speed / 18, 1);

  return (
    <div
      className={`neon-cursor-wake-chevron ${visible ? "is-visible" : ""}`}
      style={{
        transform: `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg)`,
        opacity: visible ? 0.35 + intensity * 0.45 : 0,
      }}
    >
      <svg viewBox="-40 -30 80 60" className="neon-cursor-wake-chevron-svg" aria-hidden="true">
        <path
          d="M0 -4 C-14 8 -22 18 -28 26"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="neon-cursor-wake-chevron-line"
        />
        <path
          d="M0 -4 C14 8 22 18 28 26"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="neon-cursor-wake-chevron-line"
        />
        <path
          d="M0 -4 C-8 10 -12 20 -16 28"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeDasharray="3 6"
          className="neon-cursor-wake-chevron-line neon-cursor-wake-chevron-line--inner"
        />
        <path
          d="M0 -4 C8 10 12 20 16 28"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeDasharray="3 6"
          className="neon-cursor-wake-chevron-line neon-cursor-wake-chevron-line--inner"
        />
      </svg>
    </div>
  );
}

export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<CursorMode>("default");
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [clickRipples, setClickRipples] = useState<ClickRipple[]>([]);
  const [wakeRipples, setWakeRipples] = useState<WakeRipple[]>([]);
  const [moveAngle, setMoveAngle] = useState(90);
  const [moveSpeed, setMoveSpeed] = useState(0);

  const targetRef = useRef({ x: -100, y: -100 });
  const cursorPosRef = useRef({ x: -100, y: -100 });
  const lastWakeSpawnRef = useRef({ x: -100, y: -100 });
  const rafRef = useRef<number | null>(null);
  const rippleIdRef = useRef(0);
  const moveSpeedRef = useRef(0);

  const removeClickRipple = useCallback((id: number) => {
    setClickRipples((current) => current.filter((ripple) => ripple.id !== id));
  }, []);

  const removeWakeRipple = useCallback((id: number) => {
    setWakeRipples((current) => current.filter((ripple) => ripple.id !== id));
  }, []);

  const spawnWakeRipple = useCallback((x: number, y: number, angle: number) => {
    rippleIdRef.current += 1;
    const id = rippleIdRef.current;

    setWakeRipples((current) => {
      const next = [...current, { id, x, y, angle }];
      return next.length > MAX_WAKE_RIPPLES ? next.slice(next.length - MAX_WAKE_RIPPLES) : next;
    });
  }, []);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!finePointer || coarsePointer) return;

    setEnabled(true);
    document.documentElement.classList.add("custom-cursor-active");

    const cursorLerp = reducedMotion ? 1 : LERP_CURSOR;

    const animate = () => {
      const target = targetRef.current;
      const nextCursor = {
        x: lerp(cursorPosRef.current.x, target.x, cursorLerp),
        y: lerp(cursorPosRef.current.y, target.y, cursorLerp),
      };

      cursorPosRef.current = nextCursor;
      setCursorPos(nextCursor);

      moveSpeedRef.current *= 0.88;
      setMoveSpeed(moveSpeedRef.current);

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    const handleMouseMove = (event: MouseEvent) => {
      const previous = targetRef.current;
      const next = { x: event.clientX, y: event.clientY };
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const distance = Math.hypot(dx, dy);

      targetRef.current = next;
      setVisible(true);

      if (distance > 0.5) {
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        setMoveAngle(angle);
        moveSpeedRef.current = Math.max(moveSpeedRef.current, distance);
        setMoveSpeed(moveSpeedRef.current);

        const lastWake = lastWakeSpawnRef.current;
        const wakeDx = next.x - lastWake.x;
        const wakeDy = next.y - lastWake.y;
        const wakeDistance = Math.hypot(wakeDx, wakeDy);

        if (wakeDistance >= WAKE_SPAWN_DISTANCE) {
          const wakeAngle = (Math.atan2(wakeDy, wakeDx) * 180) / Math.PI + 90;
          spawnWakeRipple(next.x, next.y, wakeAngle);
          lastWakeSpawnRef.current = next;
        }
      }

      const hovered = document.elementFromPoint(event.clientX, event.clientY);
      const clickable = hovered?.closest(POINTER_SELECTOR);
      setMode(clickable ? "pointer" : "default");
    };

    const handleMouseLeave = () => setVisible(false);
    const handleMouseEnter = () => setVisible(true);
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;

      rippleIdRef.current += 1;
      const id = rippleIdRef.current;

      setClickRipples((current) => {
        const next = [...current, { id, x: event.clientX, y: event.clientY }];
        return next.length > MAX_CLICK_RIPPLES ? next.slice(next.length - MAX_CLICK_RIPPLES) : next;
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mousedown", handleMouseDown, { passive: true });
    document.documentElement.addEventListener("mouseleave", handleMouseLeave);
    document.documentElement.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      document.documentElement.classList.remove("custom-cursor-active");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
      document.documentElement.removeEventListener("mouseenter", handleMouseEnter);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [spawnWakeRipple]);

  if (!enabled) return null;

  return (
    <div className="neon-cursor-layer" aria-hidden="true">
      {wakeRipples.map((ripple) => (
        <WakeRippleRing
          key={`wake-${ripple.id}`}
          id={ripple.id}
          x={ripple.x}
          y={ripple.y}
          angle={ripple.angle}
          onDone={() => removeWakeRipple(ripple.id)}
        />
      ))}
      {clickRipples.map((ripple) => (
        <ClickRippleBurst
          key={`click-${ripple.id}`}
          id={ripple.id}
          x={ripple.x}
          y={ripple.y}
          onDone={() => removeClickRipple(ripple.id)}
        />
      ))}
      <ShipWakeChevron
        x={cursorPos.x}
        y={cursorPos.y}
        angle={moveAngle}
        speed={moveSpeed}
        visible={visible && moveSpeed > 1.5}
      />
      <div
        className={`neon-cursor ${visible ? "is-visible" : ""} ${mode === "pointer" ? "is-pointer" : ""}`}
        style={{ transform: `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0)` }}
      >
        {mode === "pointer" ? <NeonHandCursor /> : <NeonArrowCursor />}
      </div>
    </div>
  );
}
