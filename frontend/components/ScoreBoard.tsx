"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "./useInView";

export type BoardRow = { league: string; right: number; wrong: number };

/** The scoreboard panel. The marks land one at a time, in the order the
 *  round resolved. That stagger is the shape of a matchday coming in. */
export function ScoreBoard({
  rows, title = "First graded round", totalRight, totalWrong, footnote,
}: {
  rows: BoardRow[];
  title?: string;
  totalRight?: number;
  totalWrong?: number;
  footnote?: string;
}) {
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) { setLanded(true); return; }
    const id = requestAnimationFrame(() => setLanded(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const r = totalRight ?? rows.reduce((a, x) => a + x.right, 0);
  const w = totalWrong ?? rows.reduce((a, x) => a + x.wrong, 0);

  let cell = 0;
  const delay = () => {
    const ms = prefersReducedMotion() ? 0 : 220 + cell * 28;
    cell += 1;
    return `${ms}ms`;
  };

  return (
    <div className={`tc-panel tc-board${landed ? " is-in" : ""}`}>
      <div className="tc-board__head">
        <span className="tc-label">{title}</span>
        <span className="tc-board__total">
          <span className="r">{r}</span> W <span className="w">{w}</span> L
        </span>
      </div>

      <div>
        {rows.map((row) => (
          <div className="tc-board__row" key={row.league}>
            <span className="tc-board__league">{row.league}</span>
            <span className="tc-ticks" aria-hidden="true">
              {Array.from({ length: row.right }).map((_, i) => (
                <i key={`r${i}`} className="tc-tick tc-tick--r" style={{ transitionDelay: delay() }} />
              ))}
              {Array.from({ length: row.wrong }).map((_, i) => (
                <i key={`w${i}`} className="tc-tick tc-tick--w" style={{ transitionDelay: delay() }} />
              ))}
            </span>
            <span className="tc-board__score">
              <b>{row.right}</b> W <i>{row.wrong}</i> L
            </span>
          </div>
        ))}
      </div>

      {footnote && <p className="tc-board__foot">{footnote}</p>}
    </div>
  );
}
