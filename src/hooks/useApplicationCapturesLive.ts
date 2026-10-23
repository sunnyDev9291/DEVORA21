"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api-base-url";
import { getUserApiKey } from "@/lib/user-api-key";
import {
  createApplicationCapturesStreamTicket,
  parseApplicationCapturesLiveEvent,
  type ApplicationCapturesLiveEvent,
} from "@/lib/super-admin-application-captures-api";

export type ApplicationCapturesLiveStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "offline";

type UseApplicationCapturesLiveOptions = {
  enabled?: boolean;
  onEvent: (event: ApplicationCapturesLiveEvent) => void;
};

function parseSseBlocks(
  buffer: string
): { events: Array<{ event: string; data: string }>; rest: string } {
  const normalized = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const parts = normalized.split("\n\n");
  const rest = parts.pop() || "";
  const events: Array<{ event: string; data: string }> = [];

  for (const block of parts) {
    if (!block.trim()) continue;
    let eventName = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith(":")) continue;
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

/**
 * Open GET /admin/application-captures/stream on the API origin (never a Next/BFF proxy).
 * Prefer fetch + Bearer; fall back to stream-ticket; then cookies.
 */
async function openLiveStream(signal: AbortSignal): Promise<Response> {
  const streamUrl = `${API_BASE_URL.replace(/\/$/, "")}/admin/application-captures/stream`;
  const apiKey = getUserApiKey();

  if (apiKey) {
    const res = await fetch(streamUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${apiKey}`,
      },
      credentials: "include",
      signal,
    });
    if (res.ok && res.body) return res;
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  }

  try {
    const ticket = await createApplicationCapturesStreamTicket();
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const res = await fetch(ticket.streamPath, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      credentials: "include",
      signal,
    });
    if (res.ok && res.body) return res;
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
  }

  const res = await fetch(streamUrl, {
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
 * Super Admin Application Captures live stream (SSE).
 * Connects directly to API_BASE_URL — never a buffering Next/BFF proxy.
 */
export function useApplicationCapturesLive({
  enabled = true,
  onEvent,
}: UseApplicationCapturesLiveOptions): ApplicationCapturesLiveStatus {
  const [status, setStatus] = useState<ApplicationCapturesLiveStatus>(
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
        let parsed = parseApplicationCapturesLiveEvent(eventName, raw);
        if (!parsed && raw && typeof raw === "object") {
          const type = String((raw as { type?: string }).type || "").trim();
          if (type) parsed = parseApplicationCapturesLiveEvent(type, raw);
        }
        if (!parsed) return;
        if (parsed.kind === "ready") {
          attempt = 0;
          setStatus("live");
        }
        onEventRef.current(parsed);
      } catch {
        // ignore malformed frames / heartbeats
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
        attempt = 0;
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
