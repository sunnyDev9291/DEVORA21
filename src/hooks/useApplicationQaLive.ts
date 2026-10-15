"use client";

import { useEffect, useRef, useState } from "react";
import { getUserApiKey } from "@/lib/user-api-key";
import {
  buildApplicationQaStreamUrl,
  parseApplicationQaLiveEvent,
  type ApplicationQaLiveEvent,
} from "@/lib/super-admin-application-qa-api";

export type ApplicationQaLiveStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "offline";

const LIVE_EVENT_NAMES = [
  "ready",
  "session.created",
  "session.updated",
  "session.deleted",
] as const;

type UseApplicationQaLiveOptions = {
  enabled?: boolean;
  /** Optional Bearer/API token for EventSource query (cookies preferred). */
  accessToken?: string | null;
  onEvent: (event: ApplicationQaLiveEvent) => void;
};

/**
 * Super Admin Application Q&A live stream (SSE).
 * Cookie session via withCredentials; falls back to ?access_token= for dv21_ keys.
 */
export function useApplicationQaLive({
  enabled = true,
  accessToken,
  onEvent,
}: UseApplicationQaLiveOptions): ApplicationQaLiveStatus {
  const [status, setStatus] = useState<ApplicationQaLiveStatus>(
    enabled ? "connecting" : "offline"
  );
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setStatus("offline");
      return;
    }

    let stopped = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const clearReconnect = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connect = () => {
      if (stopped) return;
      clearReconnect();

      const token = accessToken?.trim() || getUserApiKey();
      const url = buildApplicationQaStreamUrl(token);
      setStatus(attempt === 0 ? "connecting" : "reconnecting");

      try {
        es?.close();
      } catch {
        // ignore
      }

      es = new EventSource(url, { withCredentials: true });

      for (const name of LIVE_EVENT_NAMES) {
        es.addEventListener(name, (msg) => {
          if (stopped) return;
          try {
            const raw = JSON.parse((msg as MessageEvent).data as string) as unknown;
            const parsed = parseApplicationQaLiveEvent(name, raw);
            if (!parsed) return;
            if (parsed.kind === "ready") {
              attempt = 0;
              setStatus("live");
            }
            onEventRef.current(parsed);
          } catch {
            // ignore malformed frames
          }
        });
      }

      es.onerror = () => {
        if (stopped) return;
        try {
          es?.close();
        } catch {
          // ignore
        }
        es = null;
        setStatus("reconnecting");
        const delay = Math.min(15_000, 1000 * 2 ** attempt);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      stopped = true;
      clearReconnect();
      try {
        es?.close();
      } catch {
        // ignore
      }
      es = null;
    };
  }, [enabled, accessToken]);

  return status;
}
