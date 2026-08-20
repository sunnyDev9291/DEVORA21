"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { useTodaysResumeCount } from "@/hooks/useTodaysResumeCount";
import { isValidAuthUser } from "@/lib/auth-api";
import { loadStoredProfile, resolveUserNames } from "@/lib/user-profile";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const POS_STORAGE_KEY = "devora21-smartwatch-pos";
const WATCH_W = 178;
const WATCH_H = 268;

type WatchPos = { left: number; top: number };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function clampPos(left: number, top: number): WatchPos {
  if (typeof window === "undefined") return { left, top };
  const maxLeft = Math.max(8, window.innerWidth - WATCH_W - 8);
  const maxTop = Math.max(8, window.innerHeight - WATCH_H - 8);
  return {
    left: Math.min(maxLeft, Math.max(8, left)),
    top: Math.min(maxTop, Math.max(8, top)),
  };
}

function defaultPos(): WatchPos {
  if (typeof window === "undefined") return { left: 24, top: 120 };
  return clampPos(24, window.innerHeight - WATCH_H - 32);
}

function readStoredPos(): WatchPos {
  if (typeof window === "undefined") return defaultPos();
  try {
    const raw = localStorage.getItem(POS_STORAGE_KEY);
    if (!raw) return defaultPos();
    const parsed = JSON.parse(raw) as Partial<WatchPos>;
    if (typeof parsed.left !== "number" || typeof parsed.top !== "number") return defaultPos();
    return clampPos(parsed.left, parsed.top);
  } catch {
    return defaultPos();
  }
}

function shortProfileName(fullName: string, firstName: string): string {
  const first = firstName.trim();
  if (first) return first.length > 12 ? `${first.slice(0, 11)}…` : first;
  const trimmed = fullName.trim();
  if (!trimmed) return "You";
  return trimmed.length > 12 ? `${trimmed.slice(0, 11)}…` : trimmed;
}

/**
 * Large always-on smartwatch: analog current time, profile name, today's bids.
 * Drag anywhere on screen; position is remembered.
 */
export default function SmartWatchPanel({ className = "" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const { user } = useAuth();
  const { count, loading } = useTodaysResumeCount(true);
  const todayCount = loading && count == null ? null : count ?? 0;

  const [now, setNow] = useState(() => new Date());
  const [pos, setPos] = useState<WatchPos>(() => defaultPos());
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const posRef = useRef(pos);
  posRef.current = pos;

  const names =
    user && isValidAuthUser(user)
      ? resolveUserNames(user, loadStoredProfile(user.id))
      : { firstName: "", lastName: "", fullName: "" };
  const profileLabel = shortProfileName(names.fullName, names.firstName);

  useEffect(() => {
    setPos(readStoredPos());
  }, []);

  useEffect(() => {
    function onResize() {
      setPos((prev) => clampPos(prev.left, prev.top));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let timer = 0;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      setNow(new Date());
      timer = window.setTimeout(tick, 200);
    };
    timer = window.setTimeout(tick, 200);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);

  const persistPos = useCallback((next: WatchPos) => {
    try {
      localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - posRef.current.left,
      y: e.clientY - posRef.current.top,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!draggingRef.current) return;
    const next = clampPos(e.clientX - dragOffset.current.x, e.clientY - dragOffset.current.y);
    setPos(next);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    persistPos(posRef.current);
  };

  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const millis = now.getMilliseconds();
  const secondDeg = (seconds + millis / 1000) * 6;
  const minuteDeg = (minutes + seconds / 60) * 6;
  const hourDeg = (hours + minutes / 60) * 30;
  const weekday = WEEKDAYS[now.getDay()];
  const dayNum = now.getDate();
  const timeLabel = `${pad(now.getHours())}:${pad(minutes)}:${pad(seconds)}`;

  const faceId = `sw-face-${uid}`;
  const bezelId = `sw-bezel-${uid}`;
  const glowId = `sw-glow-${uid}`;
  const handMetalId = `sw-metal-${uid}`;
  const secondGlowId = `sw-sec-${uid}`;
  const dialRingId = `sw-ring-${uid}`;

  return (
    <aside
      className={`fixed z-[90] touch-none select-none ${dragging ? "cursor-grabbing" : "cursor-grab"} ${className}`}
      style={{ left: pos.left, top: pos.top }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="application"
      aria-roledescription="draggable watch"
      aria-label={`${profileLabel}. Current time ${timeLabel}. ${
        todayCount == null ? "Loading" : todayCount
      } resumes made today. Drag to move.`}
      title="Drag to move"
    >
      <div className="flex flex-col items-center drop-shadow-[0_24px_40px_rgba(2,6,23,0.55)]">
        <div
          className="h-8 w-[138px] rounded-t-2xl"
          style={{
            background:
              "linear-gradient(180deg, #334155 0%, #1e293b 45%, #0f172a 100%)",
          }}
          aria-hidden
        />

        <div className="relative rounded-[2.35rem] border border-sky-300/20 bg-gradient-to-br from-slate-600 via-slate-900 to-black p-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
          <div
            className="absolute -right-[8px] top-[40%] h-12 w-[8px] rounded-r-md bg-gradient-to-b from-slate-300 via-slate-500 to-slate-700 shadow-sm"
            aria-hidden
          />
          <div
            className="absolute -right-[6px] top-[58%] h-7 w-[5px] rounded-r-sm bg-slate-600"
            aria-hidden
          />

          <div className="relative h-[210px] w-[170px] overflow-hidden rounded-[1.85rem] bg-[#020617] ring-1 ring-sky-400/20">
            {/* Ambient mesh behind dial */}
            <div
              className="pointer-events-none absolute inset-0 opacity-90"
              style={{
                background:
                  "radial-gradient(circle at 30% 20%, rgba(56,189,248,0.28), transparent 42%), radial-gradient(circle at 78% 72%, rgba(37,99,235,0.22), transparent 40%), linear-gradient(160deg, #0b1224 0%, #020617 55%, #111827 100%)",
              }}
              aria-hidden
            />

            <svg viewBox="0 0 100 128" className="relative h-full w-full" aria-hidden>
              <defs>
                <radialGradient id={faceId} cx="38%" cy="30%" r="72%">
                  <stop offset="0%" stopColor="#1e3a5f" />
                  <stop offset="45%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#020617" />
                </radialGradient>
                <linearGradient id={bezelId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#e0f2fe" />
                  <stop offset="35%" stopColor="#38bdf8" />
                  <stop offset="70%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#020617" />
                </linearGradient>
                <radialGradient id={glowId} cx="50%" cy="45%" r="50%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={handMetalId} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="45%" stopColor="#e2e8f0" />
                  <stop offset="100%" stopColor="#94a3b8" />
                </linearGradient>
                <linearGradient id={secondGlowId} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#7dd3fc" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
                <linearGradient id={dialRingId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.2" />
                </linearGradient>
              </defs>

              <ellipse cx="50" cy="56" rx="40" ry="40" fill={`url(#${glowId})`} />
              <circle cx="50" cy="56" r="41.5" fill={`url(#${bezelId})`} opacity="0.7" />
              <circle cx="50" cy="56" r="38.2" fill={`url(#${faceId})`} stroke={`url(#${dialRingId})`} strokeWidth="1.1" />

              {/* Minute ticks */}
              {Array.from({ length: 60 }, (_, i) => {
                if (i % 5 === 0) return null;
                const angle = (i * 6 * Math.PI) / 180;
                return (
                  <line
                    key={i}
                    x1={50 + Math.sin(angle) * 34.8}
                    y1={56 - Math.cos(angle) * 34.8}
                    x2={50 + Math.sin(angle) * 32.4}
                    y2={56 - Math.cos(angle) * 32.4}
                    stroke="#64748b"
                    strokeWidth="0.55"
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Hour numbers */}
              {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n, idx) => {
                const angle = (idx * 30 * Math.PI) / 180;
                const r = 27.5;
                const x = 50 + Math.sin(angle) * r;
                const y = 56 - Math.cos(angle) * r + 1.6;
                return (
                  <text
                    key={n}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="6.2"
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                    fontWeight="700"
                  >
                    {n}
                  </text>
                );
              })}

              {/* Profile name */}
              <text
                x="50"
                y="22"
                textAnchor="middle"
                fill="#7dd3fc"
                fontSize="4.4"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight="700"
                letterSpacing="0.6"
              >
                {profileLabel.toUpperCase()}
              </text>

              {/* Weekday + date */}
              <text
                x="50"
                y="41"
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="3.8"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight="650"
                letterSpacing="1.1"
              >
                {weekday}
              </text>
              <rect x="63" y="50" width="13" height="10.5" rx="2" fill="#020617" stroke="#38bdf8" strokeWidth="0.45" opacity="0.95" />
              <text
                x="69.5"
                y="57.8"
                textAnchor="middle"
                fill="#e0f2fe"
                fontSize="5.2"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight="700"
              >
                {dayNum}
              </text>

              {/* Hour hand */}
              <g transform={`rotate(${hourDeg} 50 56)`}>
                <polygon
                  points="50,60 47.2,42 50,33 52.8,42"
                  fill={`url(#${handMetalId})`}
                  stroke="#cbd5e1"
                  strokeWidth="0.2"
                />
              </g>

              {/* Minute hand */}
              <g transform={`rotate(${minuteDeg} 50 56)`}>
                <polygon
                  points="50,62 48,38 50,24.5 52,38"
                  fill={`url(#${handMetalId})`}
                  stroke="#e2e8f0"
                  strokeWidth="0.2"
                />
              </g>

              {/* Second hand */}
              <g transform={`rotate(${secondDeg} 50 56)`}>
                <line
                  x1="50"
                  y1="66"
                  x2="50"
                  y2="23"
                  stroke={`url(#${secondGlowId})`}
                  strokeWidth="1.15"
                  strokeLinecap="round"
                />
                <circle cx="50" cy="28" r="1.7" fill="#7dd3fc" />
                <circle cx="50" cy="66" r="1.1" fill="#2563eb" />
              </g>

              <circle cx="50" cy="56" r="3.1" fill="#f8fafc" />
              <circle cx="50" cy="56" r="1.45" fill="#2563eb" />

              {/* Today bids */}
              <text
                x="50"
                y="108"
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="3.7"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight="650"
                letterSpacing="1"
              >
                TODAY
              </text>
              <rect x="40" y="111.5" width="20" height="11" rx="2.5" fill="#1d4ed8" />
              <text
                x="50"
                y="120"
                textAnchor="middle"
                fill="#f8fafc"
                fontSize="7"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight="700"
              >
                {todayCount == null ? "…" : todayCount}
              </text>
            </svg>
          </div>
        </div>

        <div
          className="h-8 w-[138px] rounded-b-2xl"
          style={{
            background: "linear-gradient(180deg, #0f172a 0%, #1e293b 55%, #334155 100%)",
          }}
          aria-hidden
        />
      </div>
    </aside>
  );
}
