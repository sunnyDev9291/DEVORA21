"use client";

import { useFollowOutputScroll } from "@/hooks/useFollowOutputScroll";
import type { RefObject, UIEventHandler } from "react";

/**
 * Auto-scrolls chat to the latest message when the user is already near the bottom.
 * If the user scrolls up to read history, auto-scroll pauses until they scroll back down.
 */
export function useChatScroll(scrollDeps: unknown[]): {
  listRef: RefObject<HTMLDivElement | null>;
  handleScroll: UIEventHandler<HTMLDivElement>;
  pinToBottom: () => void;
} {
  const { containerRef, onScroll, pinToBottom } = useFollowOutputScroll({
    deps: scrollDeps,
  });

  return {
    listRef: containerRef,
    handleScroll: onScroll,
    pinToBottom,
  };
}
