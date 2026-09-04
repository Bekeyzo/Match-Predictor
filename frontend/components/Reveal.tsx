"use client";

import { useEffect } from "react";
import { useInView } from "./useInView";

/** Eases a block in the first time it is scrolled to.
 *  Nothing above the fold goes in here. The first thing a visitor sees
 *  has to be there at rest, not waiting on an observer. */
export function Reveal({
  children,
  as: Tag = "div",
  className = "",
  threshold = 0.12,
}: {
  children: React.ReactNode;
  as?: React.ElementType;
  className?: string;
  threshold?: number;
}) {
  const [ref, inView] = useInView<HTMLDivElement>(threshold);

  useEffect(() => {
    document.documentElement.classList.add("tc-js");
  }, []);

  const Component = Tag as React.ElementType;

  return (
    <Component ref={ref} className={`tc-rv ${inView ? "is-in" : ""} ${className}`.trim()}>
      {children}
    </Component>
  );
}
