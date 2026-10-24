"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Precise #section links everywhere (navbar tiles, sync dot, cards, OAuth redirects).
// Many sections stream in later (Suspense), so the browser's own jump lands too early and the page then shifts.
// This waits for the target, puts it just below the floating navbar (its scroll-margin-top, `.scroll-mt-nav`)
// and keeps it there while content above is still settling. Any scroll / touch / key by the user stops it.

const WAIT_FOR_TARGET = 8000; // ms – a cold start can stream slowly
const SETTLE = 2000; // ms without any shift before we stop re-aligning
const MAX_SETTLE = 4000; // ms – hard stop after the target appeared
const MENU_CLOSE_WAIT = 500; // ms – let the open navbar menu shrink back first
const USER_EVENTS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

let stopCurrent: (() => void) | null = null;

/** Scroll to #id once `url` (pathname + search + hash) is the current URL; smooth only when staying on the same page. */
function alignTo(id: string, url: string, smooth: boolean) {
  stopCurrent?.();
  const startedAt = performance.now();
  let foundAt = 0;
  let lastShift = 0;
  let lastTop = 0;
  let frame = 0;
  let stuck = 0; // frames a smooth scroll hasn't moved although it isn't there yet
  let lastY = -1;

  const stop = () => {
    cancelAnimationFrame(frame);
    for (const type of USER_EVENTS) window.removeEventListener(type, stop, true);
    if (stopCurrent === stop) stopCurrent = null;
  };
  stopCurrent = stop;
  for (const type of USER_EVENTS) window.addEventListener(type, stop, { capture: true, passive: true });

  const scroll = (top: number) => window.scrollTo({ top, behavior: smooth ? "smooth" : "instant" });

  const tick = () => {
    const now = performance.now();
    const el = location.pathname + location.search + location.hash === url ? document.getElementById(id) : null;
    const nav = document.querySelector("[data-navbar]");
    const menuOpen = !foundAt && !!nav && nav.getBoundingClientRect().height > 60 && now - startedAt < MENU_CLOSE_WAIT;

    if (!el || menuOpen) {
      if (now - startedAt > WAIT_FOR_TARGET) return stop();
      frame = requestAnimationFrame(tick);
      return;
    }

    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const maxTop = document.documentElement.scrollHeight - window.innerHeight;
    const top = Math.round(Math.max(0, Math.min(maxTop, el.getBoundingClientRect().top + window.scrollY - margin)));

    if (!foundAt) {
      foundAt = lastShift = now;
      lastTop = top;
      scroll(top);
    } else if (Math.abs(top - lastTop) > 1) {
      // content above grew or shrank – follow the target
      lastShift = now;
      lastTop = top;
      scroll(top);
    } else if (Math.abs(window.scrollY - top) > 1) {
      // something else (browser / router) moved the page or cut a smooth scroll short
      stuck = window.scrollY === lastY ? stuck + 1 : 0;
      if (!smooth || stuck > 3) scroll(top);
    }
    lastY = window.scrollY;

    if (now - lastShift > SETTLE || now - foundAt > MAX_SETTLE) return stop();
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function HashScroll() {
  const router = useRouter();

  useEffect(() => {
    // Opened with a hash (reload, OAuth redirect, home-screen link).
    if (location.hash) alignTo(decodeURIComponent(location.hash.slice(1)), location.pathname + location.search + location.hash, false);

    // Capture phase on window runs before React, so a same-page link can be taken over before next/link handles it
    // (next/link still calls its onClick first – the navbar menu closes – and then skips because of preventDefault).
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href);
      if (url.origin !== location.origin || url.hash.length < 2) return;

      const path = url.pathname + url.search;
      const samePage = path === location.pathname + location.search;
      if (samePage) {
        e.preventDefault();
        router.push(path + url.hash, { scroll: false });
      }
      // Another page: next/link navigates as usual, we align once the section is there.
      alignTo(decodeURIComponent(url.hash.slice(1)), path + url.hash, samePage && !reducedMotion());
    };

    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("click", onClick, true);
      stopCurrent?.();
    };
  }, [router]);

  return null;
}
