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
};

/**
 * Mounts rrweb-player for one frame stream (never concatenates iframes).
 * Controllers: built-in scrubber + play/pause; extra 1x/2x/4x + fullscreen.
 */
export default function RrwebReplayPlayer({
  frames,
  frameKey,
  onPlay,
  className = "",
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

  useEffect(() => {
    let cancelled = false;
    let removePointer: (() => void) | undefined;
    const host = hostRef.current;
    if (!host || !frame) {
      setReady(false);
      setError(frame ? "" : "No frame selected.");
      return;
    }

    const events = Array.isArray(frame.events) ? frame.events : [];
    if (events.length < 2) {
      setReady(false);
      setError("This frame has too few events to replay.");
      return;
    }

    setError("");
    setReady(false);

    (async () => {
      try {
        const mod = (await import("rrweb-player")) as {
          default: RrwebPlayerCtor;
        };
        if (cancelled || !hostRef.current) return;

        // Tear down previous instance
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

        // Each play interaction — parent may refetch events via eventsPath while recording.
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
    // Recreate when frame identity / event count changes; speed via setSpeed effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid re-mount on array identity
  }, [frame?.frameKey, frame?.events?.length]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !ready) return;
    try {
      player.setSpeed?.(speed);
    } catch {
      /* older builds may only accept speed at construct */
    }
  }, [speed, ready]);

  function enterFullscreen() {
    const el = hostRef.current?.closest("[data-rrweb-player-shell]") as HTMLElement | null;
    const target = el || hostRef.current;
    if (!target) return;
    const req =
      target.requestFullscreen ||
      (target as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> })
        .webkitRequestFullscreen;
    void req?.call(target);
  }

  if (!frame) {
    return (
      <div className={`${saMono} flex min-h-[20rem] items-center justify-center text-xs text-slate-400 ${className}`}>
        Select a frame to replay.
      </div>
    );
  }

  return (
    <div
      data-rrweb-player-shell
      className={`flex min-h-0 flex-1 flex-col overflow-hidden ${className}`}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        <span className={`${saMono} text-[10px] uppercase tracking-[0.14em] text-slate-400`}>
          Speed
        </span>
        {SPEED_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={!ready}
            onClick={() => {
              setSpeed(opt);
              onPlayRef.current?.();
            }}
            className={`${saBtnGhost} px-2.5 py-1 text-[11px] ${
              speed === opt ? "border-teal-300 bg-teal-50 text-teal-900" : ""
            }`}
          >
            {opt}x
          </button>
        ))}
        <button
          type="button"
          disabled={!ready}
          onClick={enterFullscreen}
          className={`${saBtnGhost} ml-auto px-2.5 py-1 text-[11px]`}
        >
          Fullscreen
        </button>
      </div>

      {error ? (
        <div
          className={`${saMono} m-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800`}
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div
        className="relative min-h-0 flex-1 overflow-auto bg-slate-950/95 p-2"
        style={{ filter: "grayscale(1)" }}
      >
        <div ref={hostRef} className="rrweb-player-host mx-auto w-full max-w-full" />
        {!ready && !error ? (
          <p
            className={`${saMono} absolute inset-0 flex items-center justify-center text-xs text-slate-400`}
            aria-busy="true"
          >
            Loading player…
          </p>
        ) : null}
      </div>

      <p className={`${saMono} shrink-0 truncate border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400`}>
        {frame.isTop ? "Top frame" : "Iframe"} · {frame.frameKey}
        {frame.href ? ` · ${frame.href}` : ""}
        <span className="mx-1.5 opacity-40">·</span>
        Sensitive PII — passwords masked at record time
      </p>
    </div>
  );
}
