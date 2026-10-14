"use client";

import * as React from "react";

/*
 * Keeps a scroll container pinned to the bottom while content grows, without
 * ever fighting the user.
 *
 * - "At bottom" means within 80px of the end.
 * - A ResizeObserver on the content pins scrollTop only while pinned.
 * - Any upward scroll (wheel, touch, keys, scrollbar drag) releases the pin;
 *   returning to the bottom re-pins it.
 * - The container should use `overflow-anchor: none` so the browser's own
 *   scroll anchoring does not move things under the user.
 */

export const STICK_THRESHOLD_PX = 80;

export function useStickToBottom<S extends HTMLElement, C extends HTMLElement>() {
  const scrollRef = React.useRef<S | null>(null);
  const contentRef = React.useRef<C | null>(null);
  const pinnedRef = React.useRef(true);
  const lastTopRef = React.useRef(0);
  const [isPinned, setIsPinned] = React.useState(true);

  const setPinned = React.useCallback((v: boolean) => {
    if (pinnedRef.current === v) return;
    pinnedRef.current = v;
    setIsPinned(v);
  }, []);

  const scrollToBottom = React.useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const el = scrollRef.current;
      if (!el) return;
      setPinned(true);
      const reduce =
        typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : behavior });
      lastTopRef.current = el.scrollTop;
    },
    [setPinned],
  );

  React.useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;

    const distance = () => el.scrollHeight - el.scrollTop - el.clientHeight;

    const onScroll = () => {
      const top = el.scrollTop;
      const movedUp = top < lastTopRef.current - 1;
      lastTopRef.current = top;
      const d = distance();
      if (movedUp && d > 2) setPinned(false);
      else if (d <= STICK_THRESHOLD_PX && !movedUp) setPinned(true);
    };

    // Intent signals: release the pin before the scroll event lands, so a
    // small upward nudge inside the 80px zone is not snapped back.
    const release = () => {
      if (el.scrollHeight > el.clientHeight) setPinned(false);
    };
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) release();
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0;
      if (y > touchY + 4) release();
      touchY = y;
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "PageUp", "Home"].includes(e.key)) release();
    };

    const ro = new ResizeObserver(() => {
      if (pinnedRef.current) {
        el.scrollTop = el.scrollHeight;
        lastTopRef.current = el.scrollTop;
      }
    });
    ro.observe(content);
    ro.observe(el);

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("keydown", onKey);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("keydown", onKey);
    };
  }, [setPinned]);

  return { scrollRef, contentRef, isPinned, scrollToBottom };
}
