"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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
  addEventListener?: (event: string, handler: (params: unknown) => unknown) => void;
  getReplayer?: () => {
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
    off?: (event: string, handler: (...args: unknown[]) => void) => void;
  };
};

type RrwebPlayerCtor = new (opts: {
  target: HTMLElement;
  props: Record<string, unknown>;
}) => RrwebPlayerInstance;

const SPEED_OPTIONS = [1, 2, 4] as const;
/** rrweb-player built-in controller chrome height. */
const CONTROLLER_H = 80;

export type RrwebReplayPlayerProps = {
  /**
   * Frames available for this mount. Pass exactly one active frame
   * (play-one-at-a-time). Never concatenate multiple frames' events.
   */
  frames: RrwebEventFrame[];
  /** Active frame key — must match a frame in `frames` (no silent fallback). */
  frameKey: string;
  /** Fired on each play / controller interaction (e.g. refetch while recording). */
  onPlay?: () => void | Promise<void>;
  className?: string;
  /** Empty / blocked / loading message inside the TV screen. */
  overlayMessage?: string;
  busy?: boolean;
  /** From replayHints.skipInactive — default true. */
  skipInactive?: boolean;
};

function isPlayingPayload(raw: unknown): boolean | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const s = raw.toLowerCase();
    if (s === "playing" || s === "play" || s === "running") return true;
    if (s === "paused" || s === "pause" || s === "stopped" || s === "ended") return false;
    return null;
  }
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "object") {
    const row = raw as Record<string, unknown>;
    for (const key of ["payload", "state", "playerState", "status", "value"]) {
      const nested = isPlayingPayload(row[key]);
      if (nested !== null) return nested;
    }
  }
  return null;
}

/**
 * TV-framed rrweb player — outer chassis + inner screen.
 * Built-in scrubber stays; Play/Pause always lives in our chin (never an empty hole).
 */
export default function RrwebReplayPlayer({
  frames,
  frameKey,
  onPlay,
  className = "",
  overlayMessage,
  busy = false,
  skipInactive = true,
}: RrwebReplayPlayerProps) {
  const glassRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<RrwebPlayerInstance | null>(null);
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const playBtnId = useId();

  const [speed, setSpeed] = useState<number>(1);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  /** Bumps on every frame remount so chin controls remount with the player. */
  const [chromeKey, setChromeKey] = useState(0);

  // Strict match only — never fall back to another frame (no merge / no TOP steal).
  const frame = frames.find((f) => f.frameKey === frameKey) || null;

  const eventCount = Array.isArray(frame?.events) ? frame!.events.length : 0;
  const canMount = Boolean(frame && eventCount >= 2);
  /** Play chrome visible whenever a frame is selected (incl. empty / loading). */
  const showPlayChrome = Boolean(frame) || busy || canMount;

  const bindPlayerState = useCallback((player: RrwebPlayerInstance) => {
    const apply = (raw: unknown) => {
      const next = isPlayingPayload(raw);
      if (next !== null) setPlaying(next);
    };

    player.addEventListener?.("ui-update-player-state", apply);
    player.addEventListener?.("ui-update-current-state", apply);

    const replayer = player.getReplayer?.();
    const onStart = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onFinish = () => setPlaying(false);
    replayer?.on?.("start", onStart);
    replayer?.on?.("pause", onPause);
    replayer?.on?.("finish", onFinish);

    return () => {
      replayer?.off?.("start", onStart);
      replayer?.off?.("pause", onPause);
      replayer?.off?.("finish", onFinish);
    };
  }, []);

  useEffect(() => {
    const el = glassRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      try {
        playerRef.current?.triggerResize?.();
      } catch {
        /* ignore */
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready, chromeKey]);

  useEffect(() => {
    let cancelled = false;
    let unbindState: (() => void) | undefined;
    let removePointer: (() => void) | undefined;
    const host = hostRef.current;

    setPlaying(false);

    if (!host || !canMount || !frame) {
      setReady(false);
      if (host) {
        host.innerHTML = "";
        host.style.filter = "";
      }
      if (!overlayMessage && !busy) {
        setError(
          frame
            ? eventCount === 0
              ? "This frame has no events."
              : "This frame has too few events to replay."
            : ""
        );
      } else {
        setError("");
      }
      return;
    }

    const events = Array.isArray(frame.events) ? frame.events : [];
    setError("");
    setReady(false);

    const glass = glassRef.current;
    const rect = glass?.getBoundingClientRect();
    const width = Math.max(160, Math.floor(rect?.width || 640));
    const height = Math.max(120, Math.floor((rect?.height || 400) - CONTROLLER_H));

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
        // Full color — never grayscale (replayHints.grayscaleOk === false).
        host.style.filter = "";

        const player = new mod.default({
          target: host,
          props: {
            events,
            width,
            height,
            autoPlay: false,
            showController: true,
            speed,
            speedOption: [...SPEED_OPTIONS],
            skipInactive,
            showWarning: true,
          },
        });
        playerRef.current = player;
        unbindState = bindPlayerState(player);
        setReady(true);
        setChromeKey((k) => k + 1);
        requestAnimationFrame(() => {
          try {
            player.triggerResize?.();
            if (hostRef.current) hostRef.current.style.filter = "";
          } catch {
            /* ignore */
          }
        });

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
      unbindState?.();
      try {
        playerRef.current?.$destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      if (hostRef.current) {
        hostRef.current.innerHTML = "";
        hostRef.current.style.filter = "";
      }
    };
    // Remount on frame identity / event count (iframe switch, live refresh).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- speed via separate effect
  }, [frame?.frameKey, eventCount, canMount, bindPlayerState, skipInactive]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !ready) return;
    try {
      player.setSpeed?.(speed);
    } catch {
      /* older builds may only accept speed at construct */
    }
  }, [speed, ready]);

  const togglePlayPause = useCallback(() => {
    const player = playerRef.current;
    if (!player || !canMount) return;
    void onPlayRef.current?.();
    try {
      if (playing) {
        player.pause?.();
        setPlaying(false);
      } else {
        player.play?.();
        setPlaying(true);
      }
    } catch {
      try {
        player.toggle?.();
        setPlaying((p) => !p);
      } catch {
        /* ignore */
      }
    }
  }, [playing, canMount]);

  const screenMessage =
    error ||
    overlayMessage ||
    (!frame && !busy
      ? "Select a session URL to watch."
      : frame && !canMount && !busy
        ? eventCount === 0
          ? "This frame has no events."
          : "This frame has too few events to replay."
        : null);

  const playDisabled = !canMount || !ready || Boolean(busy && !ready);
  const playTitle = !canMount
    ? "No replayable events for this frame"
    : busy && !ready
      ? "Loading events…"
      : playing
        ? "Pause"
        : "Play";

  return (
    <div
      data-rrweb-player-shell
      className={`rrweb-tv-outer flex min-h-0 w-full flex-col ${className}`}
    >
      <div className="rrweb-tv-chassis relative flex min-h-0 flex-1 flex-col">
        <div className="rrweb-tv-bezel flex min-h-0 flex-1 flex-col p-3 sm:p-4">
          <div className="rrweb-tv-screen relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              ref={glassRef}
              className="rrweb-tv-glass relative min-h-0 flex-1 overflow-hidden"
            >
              <div
                ref={hostRef}
                className="rrweb-player-host h-full w-full"
                data-frame-key={frame?.frameKey || ""}
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

          {/* Custom chin chrome — Play/Pause always rendered in the left slot */}
          <div
            key={`chin-${frame?.frameKey || "none"}-${chromeKey}`}
            className="rrweb-tv-chin mt-3 flex shrink-0 items-center gap-2 px-1"
          >
            {showPlayChrome ? (
              <button
                id={playBtnId}
                type="button"
                disabled={playDisabled}
                title={playTitle}
                aria-label={playTitle}
                aria-pressed={playing}
                onClick={togglePlayPause}
                className={`rrweb-tv-play-btn ${saBtnGhost} inline-flex h-8 min-w-[4.5rem] shrink-0 items-center justify-center gap-1.5 border-slate-600/50 bg-slate-900/60 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-100 disabled:cursor-not-allowed disabled:opacity-45`}
              >
                {busy && !ready ? (
                  <span className="rrweb-tv-play-spinner" aria-hidden />
                ) : playing ? (
                  <>
                    <PauseIcon />
                    Pause
                  </>
                ) : (
                  <>
                    <PlayIcon />
                    Play
                  </>
                )}
              </button>
            ) : (
              <span
                className={`${saMono} inline-flex h-8 min-w-[4.5rem] shrink-0 items-center justify-center px-2 text-[10px] text-slate-500`}
                title="Nothing to replay"
              >
                —
              </span>
            )}

            <span className="rrweb-tv-led" aria-hidden />
            <span className={`${saMono} text-[10px] uppercase tracking-[0.16em] text-slate-400`}>
              Direct play
            </span>

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {SPEED_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={!ready || !canMount}
                  onClick={() => {
                    setSpeed(opt);
                    void onPlayRef.current?.();
                    try {
                      playerRef.current?.setSpeed?.(opt);
                    } catch {
                      /* ignore */
                    }
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
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
    </svg>
  );
}
