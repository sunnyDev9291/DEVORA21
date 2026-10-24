"use client";

import { useEffect, useRef, useState } from "react";
import "rrweb-player/dist/style.css";
import { saBtnGhost, saMono } from "@/components/super-admin/resume-dashboard-styles";
import type { RrwebEventFrame } from "@/lib/super-admin-rrweb-sessions-api";

type RrwebPlayerInstance = {
  $destroy?: () => void;
  pause?: () => void;
  play?: () => void;
  toggle?: () => void;
  setSpeed?: (speed: number) => void;
  goto?: (timeOffset: number, play?: boolean) => void;
  triggerResize?: () => void;
  getMetaData?: () => { totalTime?: number };
};

type RrwebPlayerCtor = new (opts: {
  target: HTMLElement;
  props: Record<string, unknown>;
}) => RrwebPlayerInstance;

const SPEED_OPTIONS = [1, 2, 4] as const;

export type RrwebReplayPlayerProps = {
  frames: RrwebEventFrame[];
  /** Active frame key — parent owns frame switcher. */
  frameKey: string;
  /** Fired on each controller/host interaction (e.g. refetch while recording). */
  onPlay?: () => void | Promise<void>;
  className?: string;
  /** Empty / blocked / loading message inside the TV screen. */
  overlayMessage?: string;
  busy?: boolean;
};

/**
 * TV-framed rrweb player — outer chassis + inner screen.
 * Direct inline play only (no fullscreen).
 */
export default function RrwebReplayPlayer({
  frames,
  frameKey,
  onPlay,
  className = "",
  overlayMessage,
  busy = false,
}: RrwebReplayPlayerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<RrwebPlayerInstance | null>(null);
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;

  const [speed, setSpeed] = useState<number>(1);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const frame =
    frames.find((f) => f.frameKey === frameKey) ||
    frames.find((f) => f.isTop) ||
    frames[0] ||
    null;

  const canMount = Boolean(frame && Array.isArray(frame.events) && frame.events.length >= 2);

  useEffect(() => {
    let cancelled = false;
    let removePointer: (() => void) | undefined;
    const host = hostRef.current;
    if (!host || !canMount || !frame) {
      setReady(false);
      if (!overlayMessage && !busy) {
        setError(frame ? "This frame has too few events to replay." : "");
      } else {
        setError("");
      }
      return;
    }

    const events = Array.isArray(frame.events) ? frame.events : [];
    setError("");
    setReady(false);

    (async () => {
      try {
        const mod = (await import("rrweb-player")) as {
          default: RrwebPlayerCtor;
        };
        if (cancelled || !hostRef.current) return;

        try {
          playerRef.current?.$destroy?.();
        } catch {
          /* ignore */
        }
        playerRef.current = null;
        host.innerHTML = "";

        const player = new mod.default({
          target: host,
          props: {
            events,
            autoPlay: false,
            showController: true,
            speed,
            speedOption: [...SPEED_OPTIONS],
            skipInactive: true,
            showWarning: true,
          },
        });
        playerRef.current = player;
        setReady(true);

        const onPointer = () => {
          void onPlayRef.current?.();
        };
        host.addEventListener("pointerdown", onPointer);
        removePointer = () => host.removeEventListener("pointerdown", onPointer);
        if (cancelled) removePointer();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not start rrweb player."
          );
          setReady(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      removePointer?.();
      try {
        playerRef.current?.$destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid re-mount on array identity
  }, [frame?.frameKey, frame?.events?.length, canMount]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !ready) return;
    try {
      player.setSpeed?.(speed);
    } catch {
      /* older builds may only accept speed at construct */
    }
  }, [speed, ready]);

  const screenMessage =
    error ||
    overlayMessage ||
    (!canMount && !busy ? "Select a session URL to watch." : null);

  return (
    <div
      data-rrweb-player-shell
      className={`rrweb-tv-outer flex min-h-0 w-full flex-col ${className}`}
    >
      {/* Outer chassis */}
      <div className="rrweb-tv-chassis relative flex min-h-0 flex-1 flex-col">
        <div className="rrweb-tv-bezel flex min-h-0 flex-1 flex-col p-3 sm:p-4">
          {/* Inner screen */}
          <div className="rrweb-tv-screen relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              className="rrweb-tv-glass relative min-h-0 flex-1 overflow-auto"
              style={{ filter: canMount ? "grayscale(1)" : undefined }}
            >
              <div
                ref={hostRef}
                className="rrweb-player-host mx-auto h-full w-full max-w-full"
              />
              {(busy || screenMessage) && !ready ? (
                <p
                  className={`${saMono} absolute inset-0 z-10 flex items-center justify-center bg-[#0b0f14]/88 px-4 text-center text-xs text-slate-300`}
                  role={error ? "alert" : "status"}
                  aria-busy={busy || undefined}
                >
                  {busy && !screenMessage ? "Loading…" : screenMessage}
                </p>
              ) : null}
              {error && ready ? (
                <p
                  className={`${saMono} absolute bottom-2 left-2 right-2 z-10 rounded-lg border border-rose-400/40 bg-rose-950/80 px-3 py-2 text-[11px] text-rose-100`}
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
            </div>
          </div>

          {/* TV chin / controls */}
          <div className="rrweb-tv-chin mt-3 flex shrink-0 items-center gap-2 px-1">
            <span className="rrweb-tv-led" aria-hidden />
            <span className={`${saMono} text-[10px] uppercase tracking-[0.16em] text-slate-400`}>
              Direct play
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {SPEED_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={!ready}
                  onClick={() => {
                    setSpeed(opt);
                    void onPlayRef.current?.();
                  }}
                  className={`${saBtnGhost} border-slate-600/40 bg-slate-900/40 px-2 py-0.5 text-[10px] text-slate-200 ${
                    speed === opt ? "border-teal-400/60 text-teal-200" : ""
                  }`}
                >
                  {opt}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {frame && canMount ? (
        <p className={`${saMono} mt-2 truncate px-1 text-[10px] text-slate-400`}>
          {frame.isTop ? "Top frame" : "Iframe"} · {frame.frameKey}
          {frame.href ? ` · ${frame.href}` : ""}
        </p>
      ) : null}
    </div>
  );
}
