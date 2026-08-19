"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

// Within this many px of the true bottom counts as "at bottom" — scroll
// containers rarely land on an exact pixel due to subpixel rendering.
const BOTTOM_THRESHOLD_PX = 64;

interface UseStickToBottomOptions {
  scrollRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
}

interface UseStickToBottomResult {
  isAtBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

// Knows nothing about chat — just pins a scroll container to its own
// bottom while the user hasn't scrolled away, and un-pins the instant they
// do. Growth is driven by a ResizeObserver on the content element, not a
// message-count effect: tokens arrive without changing message count, so
// a `useEffect` keyed on `messages.length` would never fire mid-stream.
export function useStickToBottom({ scrollRef, contentRef }: UseStickToBottomOptions): UseStickToBottomResult {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const pinnedRef = useRef(true);
  const programmaticScrollRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  const computeIsAtBottom = useCallback((el: HTMLElement) => {
    return el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD_PX;
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const el = scrollRef.current;
      if (!el) return;
      programmaticScrollRef.current = true;
      pinnedRef.current = true;
      setIsAtBottom(true);
      el.scrollTo({ top: el.scrollHeight, behavior });
    },
    [scrollRef],
  );

  // A bare scroll listener can't tell a user's upward flick apart from our
  // own auto-scroll firing the same event, so every scroll compares against
  // the previous scrollTop: moving up (and not caused by us) releases the
  // pin immediately; landing back within the threshold re-pins.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    lastScrollTopRef.current = el.scrollTop;

    const onScroll = () => {
      if (programmaticScrollRef.current) {
        // A *smooth* programmatic scroll (the jump-to-latest button) fires
        // many scroll events across its animation, only the first of which
        // is still flagged here — the rest land in the branch below like
        // any other scroll event. Consuming the flag without touching
        // pinned state (rather than recomputing it from the still-mid-
        // flight position) matters: recomputing here used to read "not at
        // the bottom yet" as "user scrolled away" and unpin mid-animation,
        // which then stopped the ResizeObserver's auto-follow from
        // tracking content that kept growing while the animation was
        // still in flight, landing it short of the real bottom.
        programmaticScrollRef.current = false;
        lastScrollTopRef.current = el.scrollTop;
        return;
      }

      const scrolledUp = el.scrollTop < lastScrollTopRef.current;
      lastScrollTopRef.current = el.scrollTop;

      if (scrolledUp) {
        pinnedRef.current = false;
        setIsAtBottom(false);
        return;
      }

      // Moving down (or not moving) never un-pins by itself — only an
      // upward scroll does that, above. This also means the remaining
      // frames of a smooth scrollToBottom() animation, which all land
      // here once the flag above is consumed, can't undo the pin either;
      // they can only confirm it once the real bottom is reached.
      if (computeIsAtBottom(el)) {
        pinnedRef.current = true;
        setIsAtBottom(true);
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef, computeIsAtBottom]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl) return;

    const observer = new ResizeObserver(() => {
      if (!pinnedRef.current) return;
      programmaticScrollRef.current = true;
      scrollEl.scrollTop = scrollEl.scrollHeight;
    });
    observer.observe(contentEl);
    return () => observer.disconnect();
  }, [scrollRef, contentRef]);

  return { isAtBottom, scrollToBottom };
}
