"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import WatchBody from "@/components/smartwatch/WatchBody";
import { useAuth } from "@/context/AuthContext";
import { useResumeGenerateTimer } from "@/hooks/useResumeGenerateTimer";
import { useTodaysResumeCount } from "@/hooks/useTodaysResumeCount";
import { isValidAuthUser } from "@/lib/auth-api";
import { formatElapsedHms } from "@/lib/format-elapsed";
import { loadStoredProfile, resolveUserNames } from "@/lib/user-profile";

const POS_STORAGE_KEY = "devora21-smartwatch-pos";
const WATCH_W = 180;
const WATCH_H = 210;

type WatchPos = { left: number; top: number };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatTimeLabel(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
 * Draggable resume overlay watch: modular smart face (warm), live today count, generate timer.
 */
export default function SmartWatchPanel({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const { count, loading } = useTodaysResumeCount(true);
  const generateTimer = useResumeGenerateTimer();
  const todayCount = loading && count == null ? null : count ?? 0;

  const [pos, setPos] = useState<WatchPos>(() => defaultPos());
  const [timeLabel, setTimeLabel] = useState(() => formatTimeLabel(new Date()));
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
  const generateDigital = generateTimer.active ? formatElapsedHms(generateTimer.elapsedMs) : null;

  useEffect(() => {
    setPos(readStoredPos());
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTimeLabel(formatTimeLabel(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onResize() {
      setPos((prev) => clampPos(prev.left, prev.top));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
      aria-label={`${profileLabel}. Current time ${timeLabel}.${
        generateDigital ? ` Generate time ${generateDigital}.` : ""
      } ${
        todayCount == null ? "Loading" : todayCount
      } resumes made today. Drag to move.`}
      title="Drag to move"
    >
      <div className="drop-shadow-[0_24px_40px_rgba(67,20,7,0.45)]">
        <WatchBody
          size="panel"
          variant="warm"
          todayCount={todayCount}
          profileLabel={profileLabel}
          generateDigital={generateDigital}
        />
      </div>
    </aside>
  );
}
