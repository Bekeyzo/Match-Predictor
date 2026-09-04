"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion, useInView } from "./useInView";

/** Counts a figure up once, when scrolled to. Worth the motion only where
 *  the number is the argument, which here means the accuracy figure. */
export function CountUp({
  to, decimals = 1, duration = 1200, className,
}: { to: number; decimals?: number; duration?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.5);
  const [value, setValue] = useState(prefersReducedMotion() ? to : 0);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) { setValue(to); return; }

    let frame = 0;
    let start: number | null = null;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min((t - start) / duration, 1);
      setValue(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, to, duration]);

  return <span ref={ref} className={className}>{value.toFixed(decimals)}</span>;
}
