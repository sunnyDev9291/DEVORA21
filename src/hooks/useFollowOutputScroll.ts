"use client";

import { useCallback, useEffect, useRef, type RefObject, type UIEventHandler } from "react";

const NEAR_BOTTOM_THRESHOLD_PX = 64;

function isNearBottom(element: HTMLElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= NEAR_BOTTOM_THRESHOLD_PX;
}

export type UseFollowOutputScrollOptions = {
  /**
   * Values that change as new content arrives (stream text, message list, etc.).
   * When follow mode is on, the container scrolls to the latest content.
   */
  deps: unknown[];
  /**
   * When this becomes true (e.g. a new generation starts), re-enable follow mode.
   * Manual scroll-away still disables follow until the user returns to the bottom.
   */
  resetFollowWhen?: boolean;
};

/**
 * Follow newly generated output only while the user is already at the bottom.
 * Manual scroll away pauses auto-scroll; scrolling back to the bottom resumes it.
 * Programmatic scrolls do not fight the user or flip follow mode incorrectly.
 */
export function useFollowOutputScroll({
  deps,
  resetFollowWhen,
}: UseFollowOutputScrollOptions): {
  containerRef: RefObject<HTMLDivElement | null>;
  onScroll: UIEventHandler<HTMLDivElement>;
  pinToBottom: () => void;
} {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const followRef = useRef(true);
  const programmaticRef = useRef(false);
  const prevResetRef = useRef<boolean | undefined>(undefined);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    programmaticRef.current = true;
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      programmaticRef.current = false;
    });
  }, []);

  const onScroll = useCallback<UIEventHandler<HTMLDivElement>>(() => {
    if (programmaticRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    followRef.current = isNearBottom(el);
  }, []);

  const pinToBottom = useCallback(() => {
    followRef.current = true;
    requestAnimationFrame(scrollToBottom);
  }, [scrollToBottom]);

  // New generation / stream session → resume follow by default.
  useEffect(() => {
    if (resetFollowWhen === undefined) return;
    if (resetFollowWhen && prevResetRef.current !== true) {
      followRef.current = true;
      requestAnimationFrame(scrollToBottom);
    }
    prevResetRef.current = resetFollowWhen;
  }, [resetFollowWhen, scrollToBottom]);

  useEffect(() => {
    if (!followRef.current) return;
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass stream content deps explicitly
  }, deps);

  return { containerRef, onScroll, pinToBottom };
}
