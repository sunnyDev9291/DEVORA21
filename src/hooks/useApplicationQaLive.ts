"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api-base-url";
import { getUserApiKey } from "@/lib/user-api-key";
import {
  buildApplicationQaStreamUrl,
  createApplicationQaStreamTicket,
  parseApplicationQaLiveEvent,
  type ApplicationQaLiveEvent,
} from "@/lib/super-admin-application-qa-api";

export type ApplicationQaLiveStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "offline";

type UseApplicationQaLiveOptions = {
  enabled?: boolean;
  onEvent: (event: ApplicationQaLiveEvent) => void;
};

function parseSseBlocks(
  buffer: string
): { events: Array<{ event: string; data: string }>; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() || "";
  const events: Array<{ event: string; data: string }> = [];

  for (const block of parts) {
    if (!block.trim()) continue;
    let eventName = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith(":")) continue; // heartbeat comment
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim() || "message";
        continue;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }
    if (!dataLines.length) continue;
    events.push({ event: eventName, data: dataLines.join("\n") });
  }

  return { events, rest };
}

async function openLiveStream(signal: AbortSignal): Promise<Response> {
  const apiKey = getUserApiKey();

  // 1) Preferred: fetch + Bearer when a dv21_ key is available.
  if (apiKey) {
    const res = await fetch(buildApplicationQaStreamUrl(null), {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${apiKey}`,
      },
      credentials: "include",
      signal,
    });
    if (res.ok && res.body) return res;
    if (res.status !== 401 && res.status !== 403) {
      throw new Error(`SSE HTTP ${res.status}`);
    }
  }

  // 2) Cookie session: fetch stream with credentials (same as other /admin REST).
  {
    const res = await fetch(`${API_BASE_URL}/admin/application-qa/stream`, {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      credentials: "include",
      signal,
    });
    if (res.ok && res.body) return res;
    if (res.status !== 401 && res.status !== 403) {
      throw new Error(`SSE HTTP ${res.status}`);
    }
  }

  // 3) Ticket: POST with normal admin auth, then GET stream with ticket query.
  const ticket = await createApplicationQaStreamTicket();
  const res = await fetch(ticket.streamPath, {
    method: "GET",
    headers: { Accept: "text/event-stream" },
    credentials: "include",
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`SSE HTTP ${res.status}`);
  }
  return res;
}

/**
 * Super Admin Application Q&A live stream (SSE).
 * Uses fetch + Authorization/cookies (EventSource cannot set Bearer headers).
 * Connects directly to API_BASE_URL — never a buffering Next/BFF proxy.
 */
export function useApplicationQaLive({
  enabled = true,
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
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let abort: AbortController | null = null;

    const clearReconnect = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const emitParsed = (eventName: string, dataText: string) => {
      try {
        const raw = JSON.parse(dataText) as unknown;
        const parsed = parseApplicationQaLiveEvent(eventName, raw);
        if (!parsed) {
          // Also try payload.type when named event was "message"
          const typed =
            raw && typeof raw === "object"
              ? parseApplicationQaLiveEvent(
                  String((raw as { type?: string }).type || ""),
                  raw
                )
              : null;
          if (!typed) return;
          if (typed.kind === "ready") {
            attempt = 0;
            setStatus("live");
          }
          onEventRef.current(typed);
          return;
        }
        if (parsed.kind === "ready") {
          attempt = 0;
          setStatus("live");
        }
        onEventRef.current(parsed);
      } catch {
        // ignore malformed frames
      }
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      setStatus("reconnecting");
      const delay = Math.min(15_000, 1000 * 2 ** attempt);
      attempt += 1;
      clearReconnect();
      reconnectTimer = setTimeout(() => {
        void run();
      }, delay);
    };

    const run = async () => {
      if (stopped) return;
      clearReconnect();
      abort?.abort();
      abort = new AbortController();
      setStatus(attempt === 0 ? "connecting" : "reconnecting");

      try {
        const res = await openLiveStream(abort.signal);
        if (stopped) return;
        if (!res.body) throw new Error("No SSE body");

        setStatus("live");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { events, rest } = parseSseBlocks(buffer);
          buffer = rest;
          for (const ev of events) {
            emitParsed(ev.event, ev.data);
          }
        }

        if (!stopped) scheduleReconnect();
      } catch (err) {
        if (stopped) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        scheduleReconnect();
      }
    };

    void run();

    return () => {
      stopped = true;
      clearReconnect();
      abort?.abort();
    };
  }, [enabled]);

  return status;
}
