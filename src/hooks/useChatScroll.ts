"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

const NEAR_BOTTOM_THRESHOLD_PX = 48;

function isNearBottom(element: HTMLDivElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= NEAR_BOTTOM_THRESHOLD_PX;
}

/**
 * Auto-scrolls chat to the latest message when the user is already near the bottom.
 * If the user scrolls up to read history, auto-scroll pauses until they scroll back down.
 */
export function useChatScroll(scrollDeps: unknown[]): {
  listRef: RefObject<HTMLDivElement | null>;
  handleScroll: () => void;
  pinToBottom: () => void;
} {
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    stickToBottomRef.current = isNearBottom(el);
  }, []);

  const pinToBottom = useCallback(() => {
    stickToBottomRef.current = true;
    requestAnimationFrame(scrollToBottom);
  }, [scrollToBottom]);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollToBottom();
  }, scrollDeps);

  return { listRef, handleScroll, pinToBottom };
}
