"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

type CursorMode = "default" | "pointer";

type TrailNode = {
  x: number;
  y: number;
  angle: number;
  speed: number;
  age: number;
};

type TrailParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  size: number;
};

type ClickBurst = {
  id: number;
  x: number;
  y: number;
};

const POINTER_SELECTOR =
  'a, button, summary, [role="button"], [role="link"], input:not([type="hidden"]), select, textarea, label[for], [data-cursor="pointer"], .cursor-pointer';

const CURSOR_SRC = "/images/smart-cursor-arrow.png";
const CURSOR_NATURAL = { width: 205, height: 179 };
const CURSOR_DISPLAY_WIDTH = 24;
const TIP_IN_IMAGE = { x: 32, y: 24 };

const SCALE = CURSOR_DISPLAY_WIDTH / CURSOR_NATURAL.width;
const HOTSPOT = {
  x: TIP_IN_IMAGE.x * SCALE,
  y: TIP_IN_IMAGE.y * SCALE,
};

const LERP = 0.28;
const TRAIL_SPAWN_DISTANCE = 3.5;
const TRAIL_MAX_AGE = 44;
const MAX_TRAIL_NODES = 48;
const MAX_PARTICLES = 32;
const CLICK_EFFECT_MS = 1200;
const MAX_CLICK_BURSTS = 4;
const EFFECT_ALPHA = 0.86;

const CLICK_PARTICLES = Array.from({ length: 10 }, (_, index) => ({
  angle: (index / 10) * 360,
  delay: index * 0.045,
  distance: 22 + (index % 3) * 8,
}));

function supportsSmartCursor() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(any-pointer: fine)").matches;
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function ClickBurstEffect({ burst, onDone }: { burst: ClickBurst; onDone: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDone(burst.id), CLICK_EFFECT_MS);
    return () => window.clearTimeout(timer);
  }, [burst.id, onDone]);

  return (
    <div
      className="smart-cursor-click"
      style={{ transform: `translate3d(${burst.x}px, ${burst.y}px, 0)` }}
      aria-hidden="true"
    >
      <div className="smart-cursor-click-glow" />
      <div className="smart-cursor-click-core" />
      <div className="smart-cursor-click-ring smart-cursor-click-ring--1" />
      <div className="smart-cursor-click-ring smart-cursor-click-ring--2" />
      <div className="smart-cursor-click-ring smart-cursor-click-ring--3" />
      <div className="smart-cursor-click-ring smart-cursor-click-ring--4" />
      {CLICK_PARTICLES.map((particle) => (
        <span
          key={`${burst.id}-${particle.angle}`}
          className="smart-cursor-click-particle"
          style={
            {
              "--angle": `${particle.angle}deg`,
              "--distance": `${particle.distance}px`,
              "--delay": `${particle.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function drawTrailFrame(
  ctx: CanvasRenderingContext2D,
  nodes: TrailNode[],
  particles: TrailParticle[],
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = "lighter";

  if (nodes.length >= 2) {
    for (let i = 1; i < nodes.length; i += 1) {
      const current = nodes[i];
      const previous = nodes[i - 1];
      const life = 1 - current.age / TRAIL_MAX_AGE;
      if (life <= 0) continue;

      const intensity = Math.min(current.speed / 18, 1);
      const widthStroke = 1 + intensity * 2.1;
      const fade = life * (0.45 + intensity * 0.35) * EFFECT_ALPHA;

      const gradient = ctx.createLinearGradient(previous.x, previous.y, current.x, current.y);
      gradient.addColorStop(0, `rgba(255, 237, 213, ${fade * 0.16})`);
      gradient.addColorStop(0.55, `rgba(251, 146, 60, ${fade * 0.3})`);
      gradient.addColorStop(1, `rgba(249, 115, 22, ${fade * 0.18})`);

      ctx.beginPath();
      ctx.moveTo(previous.x, previous.y);

      if (i < nodes.length - 1) {
        const next = nodes[i + 1];
        ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
      } else {
        ctx.lineTo(current.x, current.y);
      }

      ctx.strokeStyle = gradient;
      ctx.lineWidth = widthStroke;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      if (intensity > 0.45) {
        const blurLength = 8 + intensity * 16;
        const tailX = current.x - Math.cos(current.angle) * blurLength;
        const tailY = current.y - Math.sin(current.angle) * blurLength;
        const blur = ctx.createLinearGradient(tailX, tailY, current.x, current.y);
        blur.addColorStop(0, "rgba(234, 88, 12, 0)");
        blur.addColorStop(0.6, `rgba(249, 115, 22, ${fade * 0.1 * intensity})`);
        blur.addColorStop(1, `rgba(255, 237, 213, ${fade * 0.18 * intensity})`);
        ctx.strokeStyle = blur;
        ctx.lineWidth = widthStroke * 1.2;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(current.x, current.y);
        ctx.stroke();
      }
    }
  }

  for (const particle of particles) {
    const life = 1 - particle.age / particle.maxAge;
    if (life <= 0) continue;

    const glow = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.size * 2.2);
    glow.addColorStop(0, `rgba(255, 237, 213, ${life * 0.55 * EFFECT_ALPHA})`);
    glow.addColorStop(0.5, `rgba(251, 146, 60, ${life * 0.28 * EFFECT_ALPHA})`);
    glow.addColorStop(1, "rgba(234, 88, 12, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
}

export default function SmartCursor() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [clicking, setClicking] = useState(false);
  const [mode, setMode] = useState<CursorMode>("default");
  const [clickBursts, setClickBursts] = useState<ClickBurst[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef({ x: -100, y: -100 });
  const currentRef = useRef({ x: -100, y: -100 });
  const lastTrailRef = useRef({ x: -100, y: -100 });
  const trailNodesRef = useRef<TrailNode[]>([]);
  const particlesRef = useRef<TrailParticle[]>([]);
  const modeRef = useRef<CursorMode>("default");
  const rafRef = useRef<number | null>(null);
  const burstIdRef = useRef(0);
  const clickFlashRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);
  const hasMovedRef = useRef(false);

  const removeBurst = useCallback((id: number) => {
    setClickBursts((current) => current.filter((burst) => burst.id !== id));
  }, []);

  useEffect(() => {
    if (!supportsSmartCursor()) return undefined;
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMounted(true);
    return undefined;
  }, []);

  useEffect(() => {
    if (!mounted) return undefined;

    document.documentElement.classList.add("smart-cursor-active");

    const canvas = canvasRef.current;
    const shell = shellRef.current;
    if (!canvas || !shell) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const applyPosition = (x: number, y: number) => {
      shell.style.transform = `translate3d(${x - HOTSPOT.x}px, ${y - HOTSPOT.y}px, 0)`;
    };

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };

    const addTrailNode = (x: number, y: number, angle: number, speed: number) => {
      trailNodesRef.current.push({ x, y, angle, speed, age: 0 });
      if (trailNodesRef.current.length > MAX_TRAIL_NODES) {
        trailNodesRef.current.splice(0, trailNodesRef.current.length - MAX_TRAIL_NODES);
      }

      if (speed < 7) return;

      const spawnCount = speed > 13 && Math.random() > 0.5 ? 2 : 1;
      for (let i = 0; i < spawnCount; i += 1) {
        const spread = (Math.random() - 0.5) * 0.75;
        const particleAngle = angle + Math.PI + spread;
        const force = 0.28 + Math.random() * 0.6;
        particlesRef.current.push({
          x: x - Math.cos(angle) * 2.5,
          y: y - Math.sin(angle) * 2.5,
          vx: Math.cos(particleAngle) * force,
          vy: Math.sin(particleAngle) * force,
          age: 0,
          maxAge: 20 + Math.floor(Math.random() * 12),
          size: 0.65 + Math.random() * 1.1,
        });
      }

      if (particlesRef.current.length > MAX_PARTICLES) {
        particlesRef.current.splice(0, particlesRef.current.length - MAX_PARTICLES);
      }
    };

    const recordTrail = (clientX: number, clientY: number) => {
      if (reducedMotionRef.current) return;

      const last = lastTrailRef.current;
      const dx = clientX - last.x;
      const dy = clientY - last.y;
      const distance = Math.hypot(dx, dy);

      if (!hasMovedRef.current) {
        hasMovedRef.current = true;
        lastTrailRef.current = { x: clientX, y: clientY };
        return;
      }

      if (distance < TRAIL_SPAWN_DISTANCE) return;

      const angle = Math.atan2(dy, dx);
      const speed = Math.min(distance, 24);

      let traveled = 0;
      while (traveled < distance) {
        const step = Math.min(TRAIL_SPAWN_DISTANCE, distance - traveled);
        traveled += step;
        const t = traveled / distance;
        addTrailNode(last.x + dx * t, last.y + dy * t, angle, speed);
      }

      lastTrailRef.current = { x: clientX, y: clientY };
    };

    const paintFrame = () => {
      trailNodesRef.current = trailNodesRef.current
        .map((node) => ({ ...node, age: node.age + 1 }))
        .filter((node) => node.age < TRAIL_MAX_AGE);

      particlesRef.current = particlesRef.current
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          vx: particle.vx * 0.94,
          vy: particle.vy * 0.94,
          age: particle.age + 1,
        }))
        .filter((particle) => particle.age < particle.maxAge);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawTrailFrame(ctx, trailNodesRef.current, particlesRef.current, window.innerWidth, window.innerHeight);
    };

    const animate = () => {
      const target = targetRef.current;
      const lerpAmount = reducedMotionRef.current ? 1 : LERP;
      const next = {
        x: lerp(currentRef.current.x, target.x, lerpAmount),
        y: lerp(currentRef.current.y, target.y, lerpAmount),
      };

      currentRef.current = next;
      applyPosition(next.x, next.y);
      recordTrail(next.x, next.y);
      paintFrame();
      rafRef.current = requestAnimationFrame(animate);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;

      targetRef.current = { x: event.clientX, y: event.clientY };
      setVisible(true);

      const hovered = document.elementFromPoint(event.clientX, event.clientY);
      const nextMode: CursorMode = hovered?.closest(POINTER_SELECTOR) ? "pointer" : "default";
      if (nextMode !== modeRef.current) {
        modeRef.current = nextMode;
        setMode(nextMode);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.button !== 0) return;

      const { clientX, clientY } = event;
      targetRef.current = { x: clientX, y: clientY };
      currentRef.current = { x: clientX, y: clientY };
      lastTrailRef.current = { x: clientX, y: clientY };
      applyPosition(clientX, clientY);

      setClicking(true);
      if (clickFlashRef.current !== null) window.clearTimeout(clickFlashRef.current);
      clickFlashRef.current = window.setTimeout(() => setClicking(false), 220);

      if (!reducedMotionRef.current) {
        burstIdRef.current += 1;
        const id = burstIdRef.current;
        setClickBursts((current) => {
          const next = [...current, { id, x: clientX, y: clientY }];
          return next.length > MAX_CLICK_BURSTS ? next.slice(next.length - MAX_CLICK_BURSTS) : next;
        });
      }
    };

    const handleMouseLeave = () => setVisible(false);
    const handleMouseEnter = () => setVisible(true);

    resizeCanvas();
    rafRef.current = requestAnimationFrame(animate);

    window.addEventListener("resize", resizeCanvas);
    document.addEventListener("pointermove", handlePointerMove, { passive: true, capture: true });
    document.addEventListener("pointerdown", handlePointerDown, { passive: true, capture: true });
    document.documentElement.addEventListener("mouseleave", handleMouseLeave);
    document.documentElement.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      document.documentElement.classList.remove("smart-cursor-active");
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (clickFlashRef.current !== null) window.clearTimeout(clickFlashRef.current);
      window.removeEventListener("resize", resizeCanvas);
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
      document.documentElement.removeEventListener("mouseenter", handleMouseEnter);
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <>
      <canvas ref={canvasRef} className="smart-cursor-trail-canvas" aria-hidden="true" />
      {clickBursts.map((burst) => (
        <ClickBurstEffect key={burst.id} burst={burst} onDone={removeBurst} />
      ))}
      <div
        ref={shellRef}
        className={`smart-cursor-shell ${visible ? "is-visible" : ""} ${mode === "pointer" ? "is-pointer" : ""} ${clicking ? "is-clicking" : ""}`}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={CURSOR_SRC}
          alt=""
          width={CURSOR_NATURAL.width}
          height={CURSOR_NATURAL.height}
          className="smart-cursor-img"
          draggable={false}
        />
      </div>
    </>,
    document.body,
  );
}
