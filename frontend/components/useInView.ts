"use client";

import { useEffect, useRef, useState } from "react";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Fires once when the element first enters the viewport.
 *  Under reduced motion it reports true immediately, so gated content
 *  renders finished rather than never arriving. No scroll listener.
 *  Return type is inferred: React 18 and 19 type useRef(null) differently. */
export function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.35) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) { setInView(true); return; }
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { setInView(true); io.unobserve(e.target); }
        });
      },
      { threshold, rootMargin: "0px 0px -6% 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return [ref, inView] as const;
}
