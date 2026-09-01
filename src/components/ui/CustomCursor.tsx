"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CursorMode = "default" | "pointer";

type ClickRipple = {
  id: number;
  x: number;
  y: number;
};

type WakePoint = {
  x: number;
  y: number;
  angle: number;
  speed: number;
  age: number;
  maxAge: number;
  wobble: number;
};

type PathNode = {
  x: number;
  y: number;
  angle: number;
  speed: number;
  age: number;
};

const POINTER_SELECTOR =
  'a, button, summary, [role="button"], [role="link"], input:not([type="hidden"]), select, textarea, label[for], [data-cursor="pointer"], .cursor-pointer';

const LERP_CURSOR = 0.22;
const CLICK_RIPPLE_DURATION_MS = 920;
const MAX_CLICK_RIPPLES = 8;
const WAKE_SPAWN_DISTANCE = 7;
const MAX_WAKE_POINTS = 42;
const MAX_PATH_NODES = 14;

const WARM = {
  glow: "#FFEDD5",
  stroke: "#FED7AA",
  fill: "rgba(251, 146, 60, 0.32)",
  ring: "rgba(249, 115, 22",
  ringSoft: "rgba(251, 191, 36",
  crest: "rgba(253, 186, 116",
  wake: "rgba(234, 88, 12",
} as const;

const CLICK_RIPPLE_RINGS = [
  { radius: 16, dash: "3 7", width: 2.8, delay: 0 },
  { radius: 26, dash: "5 9", width: 2.4, delay: 0.04 },
  { radius: 36, dash: "7 11", width: 2.1, delay: 0.08 },
  { radius: 48, dash: "9 13", width: 1.8, delay: 0.12 },
  { radius: 60, dash: "11 15", width: 1.5, delay: 0.16 },
  { radius: 72, dash: "13 17", width: 1.2, delay: 0.2 },
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

function WarmGlowDefs() {
  return (
    <defs>
      <filter id="warm-cursor-glow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="0 0 0 0 0.98
                  0 0 0 0 0.57
                  0 0 0 0 0.18
                  0 0 0 0.85 0"
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

function WarmArrowCursor() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="warm-cursor-icon"
      aria-hidden="true"
    >
      <WarmGlowDefs />
      <path
        d="M4.5 3.5L4.5 19.5L9.5 14.5L13.5 23.5L16.5 21.5L12.5 12.5H20.5L4.5 3.5Z"
        fill={WARM.fill}
        stroke={WARM.stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
        filter="url(#warm-cursor-glow)"
      />
    </svg>
  );
}

function WarmHandCursor() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="warm-cursor-icon"
      aria-hidden="true"
    >
      <WarmGlowDefs />
      <path
        d="M10 12.5V8.25C10 7.007 11.007 6 12.25 6C13.493 6 14.5 7.007 14.5 8.25V12.5M14.5 12.5V6.75C14.5 5.507 15.507 4.5 16.75 4.5C17.993 4.5 19 5.507 19 6.75V13.25C19 17.807 15.307 21.5 10.75 21.5H9.75C6.574 21.5 4 18.926 4 15.75V14.25C4 13.007 5.007 12 6.25 12C7.493 12 8.5 13.007 8.5 14.25V12.5H10"
        stroke={WARM.stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={WARM.fill}
        filter="url(#warm-cursor-glow)"
      />
    </svg>
  );
}

function ClickRippleBurst({ id, x, y, onDone }: { id: number; x: number; y: number; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, CLICK_RIPPLE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  const glowId = `warm-cursor-click-glow-${id}`;

  return (
    <div className="warm-cursor-ripple warm-cursor-ripple--click" style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}>
      <svg viewBox="-90 -90 180 180" className="warm-cursor-ripple-svg warm-cursor-ripple-svg--click" aria-hidden="true">
        <defs>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(251, 146, 60, 0.45)" />
            <stop offset="55%" stopColor="rgba(249, 115, 22, 0.18)" />
            <stop offset="100%" stopColor="rgba(234, 88, 12, 0)" />
          </radialGradient>
        </defs>

        <circle r="34" fill={`url(#${glowId})`} className="warm-cursor-ripple-glow" />

        {CLICK_RIPPLE_RINGS.map((ring, index) => (
          <g key={ring.radius} className="warm-cursor-ripple-ring" style={{ animationDelay: `${ring.delay}s` }}>
            <circle
              r={ring.radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={ring.width}
              strokeDasharray={ring.dash}
              strokeLinecap="round"
              className={index % 2 === 0 ? "warm-cursor-ripple-ring-inner" : "warm-cursor-ripple-ring-outer"}
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
              className="warm-cursor-ripple-particle"
              style={{ animationDelay: `${particle.delay}s` }}
            />
          );
        })}
      </svg>
    </div>
  );
}

function drawSpreadingRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  angle: number,
  opacity: number,
  wobble: number,
  age: number,
) {
  const distortion = Math.sin(age * 0.14 + wobble) * 2.5;
  const rx = radius + distortion;
  const ry = radius * (0.48 + Math.sin(age * 0.11 + wobble * 1.3) * 0.06);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = `${WARM.ring}, ${opacity})`;
  ctx.lineWidth = Math.max(0.4, 2.2 - radius * 0.018);
  ctx.setLineDash([5 + wobble, 8 + wobble * 0.5]);
  ctx.lineDashOffset = -age * 1.6;
  ctx.stroke();
  ctx.restore();
}

function drawLateralCrest(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  side: -1 | 1,
  spread: number,
  opacity: number,
  age: number,
  wobble: number,
) {
  const lateral = angle + (side * Math.PI) / 2;
  const length = 10 + spread * 22 + Math.sin(age * 0.2 + wobble) * 3;
  const bulge = 6 + spread * 14;

  const startX = x + Math.cos(lateral) * 2;
  const startY = y + Math.sin(lateral) * 2;
  const endX = x + Math.cos(lateral) * length;
  const endY = y + Math.sin(lateral) * length;
  const ctrlX = x + Math.cos(lateral + side * 0.55) * bulge;
  const ctrlY = y + Math.sin(lateral + side * 0.55) * bulge;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
  ctx.strokeStyle = `${WARM.crest}, ${opacity})`;
  ctx.lineWidth = Math.max(0.35, 1.6 - spread * 0.8);
  ctx.lineCap = "round";
  ctx.stroke();
}

function drawKelvinWakeArms(
  ctx: CanvasRenderingContext2D,
  path: PathNode[],
  time: number,
) {
  if (path.length < 2) return;

  const head = path[0];
  const intensity = Math.min(head.speed / 16, 1);
  if (intensity < 0.08) return;

  const wakeAngle = head.angle + Math.PI;
  const armLength = 18 + intensity * 34;
  const spread = 0.42 + intensity * 0.18;

  for (const side of [-1, 1] as const) {
    const armAngle = wakeAngle + side * spread;
    const wobble = Math.sin(time * 0.004 + side) * 4;

    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    ctx.quadraticCurveTo(
      head.x + Math.cos(armAngle - side * 0.15) * armLength * 0.45 + wobble,
      head.y + Math.sin(armAngle - side * 0.15) * armLength * 0.45,
      head.x + Math.cos(armAngle) * armLength,
      head.y + Math.sin(armAngle) * armLength,
    );
    ctx.strokeStyle = `${WARM.wake}, ${0.22 + intensity * 0.28})`;
    ctx.lineWidth = 1.2 + intensity * 0.8;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  for (let i = 1; i < path.length - 1; i += 1) {
    const node = path[i];
    const fade = 1 - node.age / (MAX_PATH_NODES + 2);
    if (fade <= 0) continue;

    for (const side of [-1, 1] as const) {
      const rippleAngle = node.angle + Math.PI + side * 0.35;
      const dist = 6 + fade * 16 + Math.sin(time * 0.003 + i + side) * 2;

      ctx.beginPath();
      ctx.arc(
        node.x + Math.cos(rippleAngle) * dist * 0.35,
        node.y + Math.sin(rippleAngle) * dist * 0.35,
        dist * 0.55,
        rippleAngle - 0.8,
        rippleAngle + 0.8,
      );
      ctx.strokeStyle = `${WARM.ringSoft}, ${fade * 0.18})`;
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
  }
}

function drawWakeField(
  ctx: CanvasRenderingContext2D,
  wakePoints: WakePoint[],
  pathNodes: PathNode[],
  time: number,
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);

  for (const point of wakePoints) {
    const life = 1 - point.age / point.maxAge;
    if (life <= 0) continue;

    const spread = point.age * (0.55 + point.speed * 0.04);
    const ringCount = 4;

    for (let ring = 0; ring < ringCount; ring += 1) {
      const ringRadius = spread - ring * 7;
      if (ringRadius <= 2) continue;

      const ringOpacity = life * (0.34 - ring * 0.07) * (0.7 + Math.min(point.speed / 20, 0.3));
      drawSpreadingRing(ctx, point.x, point.y, ringRadius, point.angle, ringOpacity, point.wobble + ring, point.age);
    }

    if (life > 0.25) {
      const crestOpacity = life * 0.32 * Math.min(point.speed / 12, 1);
      const crestSpread = point.age / point.maxAge;
      drawLateralCrest(ctx, point.x, point.y, point.angle, -1, crestSpread, crestOpacity, point.age, point.wobble);
      drawLateralCrest(ctx, point.x, point.y, point.angle, 1, crestSpread, crestOpacity, point.age, point.wobble);
    }

    const glowRadius = spread * 0.65;
    if (glowRadius > 1) {
      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, glowRadius);
      gradient.addColorStop(0, `rgba(251, 191, 36, ${life * 0.12})`);
      gradient.addColorStop(0.55, `rgba(249, 115, 22, ${life * 0.06})`);
      gradient.addColorStop(1, "rgba(234, 88, 12, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, glowRadius, glowRadius * 0.5, point.angle, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawKelvinWakeArms(ctx, pathNodes, time);
}

export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<CursorMode>("default");
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [clickRipples, setClickRipples] = useState<ClickRipple[]>([]);

  const targetRef = useRef({ x: -100, y: -100 });
  const cursorPosRef = useRef({ x: -100, y: -100 });
  const lastWakeSpawnRef = useRef({ x: -100, y: -100 });
  const wakePointsRef = useRef<WakePoint[]>([]);
  const pathNodesRef = useRef<PathNode[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const rippleIdRef = useRef(0);
  const timeRef = useRef(0);

  const removeClickRipple = useCallback((id: number) => {
    setClickRipples((current) => current.filter((ripple) => ripple.id !== id));
  }, []);

  const addWakePoint = useCallback((x: number, y: number, angle: number, speed: number) => {
    wakePointsRef.current.push({
      x,
      y,
      angle,
      speed,
      age: 0,
      maxAge: 78 + Math.min(speed * 2.5, 24),
      wobble: Math.random() * Math.PI * 2,
    });

    if (wakePointsRef.current.length > MAX_WAKE_POINTS) {
      wakePointsRef.current.splice(0, wakePointsRef.current.length - MAX_WAKE_POINTS);
    }

    pathNodesRef.current.unshift({ x, y, angle, speed, age: 0 });
    if (pathNodesRef.current.length > MAX_PATH_NODES) {
      pathNodesRef.current.length = MAX_PATH_NODES;
    }
  }, []);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!finePointer || coarsePointer) return;

    setEnabled(true);
    document.documentElement.classList.add("custom-cursor-active");

    const cursorLerp = reducedMotion ? 1 : LERP_CURSOR;

    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const animate = (timestamp: number) => {
      timeRef.current = timestamp;
      const target = targetRef.current;
      const nextCursor = {
        x: lerp(cursorPosRef.current.x, target.x, cursorLerp),
        y: lerp(cursorPosRef.current.y, target.y, cursorLerp),
      };

      cursorPosRef.current = nextCursor;
      setCursorPos(nextCursor);

      wakePointsRef.current = wakePointsRef.current
        .map((point) => ({ ...point, age: point.age + 1 }))
        .filter((point) => point.age < point.maxAge);

      pathNodesRef.current = pathNodesRef.current
        .map((node) => ({ ...node, age: node.age + 1 }))
        .filter((node) => node.age < MAX_PATH_NODES + 4);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.filter = "blur(0.35px)";
        drawWakeField(
          ctx,
          wakePointsRef.current,
          pathNodesRef.current,
          timestamp,
          window.innerWidth,
          window.innerHeight,
        );
        ctx.filter = "none";
      }

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

      if (distance > 0.4) {
        const angle = Math.atan2(dy, dx);
        const lastWake = lastWakeSpawnRef.current;
        const wakeDx = next.x - lastWake.x;
        const wakeDy = next.y - lastWake.y;
        const wakeDistance = Math.hypot(wakeDx, wakeDy);

        if (wakeDistance >= WAKE_SPAWN_DISTANCE) {
          addWakePoint(next.x, next.y, angle, Math.min(distance, 28));
          lastWakeSpawnRef.current = next;
        } else if (wakeDistance > 0 && wakePointsRef.current.length === 0) {
          addWakePoint(next.x, next.y, angle, Math.min(distance, 28));
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

      addWakePoint(event.clientX, event.clientY, 0, 14);

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
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
      document.documentElement.removeEventListener("mouseenter", handleMouseEnter);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [addWakePoint]);

  if (!enabled) return null;

  return (
    <div className="warm-cursor-layer" aria-hidden="true">
      <canvas ref={canvasRef} className="warm-cursor-wake-canvas" />
      {clickRipples.map((ripple) => (
        <ClickRippleBurst
          key={`click-${ripple.id}`}
          id={ripple.id}
          x={ripple.x}
          y={ripple.y}
          onDone={() => removeClickRipple(ripple.id)}
        />
      ))}
      <div
        className={`warm-cursor ${visible ? "is-visible" : ""} ${mode === "pointer" ? "is-pointer" : ""}`}
        style={{ transform: `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0)` }}
      >
        {mode === "pointer" ? <WarmHandCursor /> : <WarmArrowCursor />}
      </div>
    </div>
  );
}
