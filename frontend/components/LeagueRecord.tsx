"use client";

import { useInView } from "./useInView";

export type RecordRow = { league: string; right: number; wrong: number; note?: string };

function RecordItem({ row }: { row: RecordRow }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.5);
  const total = Math.max(row.right + row.wrong, 1);

  return (
    <div className="tc-record__item" ref={ref}>
      <div className="tc-record__top">
        <span className="tc-record__name">{row.league}</span>
        <span className="tc-record__score">
          <b>{row.right}</b> W <i>{row.wrong}</i> L
        </span>
      </div>
      <div className="tc-record__bar">
        <span className="r" style={{ width: inView ? `${(row.right / total) * 100}%` : "0%" }} />
        <span className="w" style={{ width: inView ? `${(row.wrong / total) * 100}%` : "0%" }} />
      </div>
      {row.note && <span className="tc-record__note">{row.note}</span>}
    </div>
  );
}

/** Every league's week, printed at the same size. Weak leagues are not
 *  sorted to the bottom and not visually shrunk. That is the whole argument
 *  the page makes, so the layout holds to it even at 0 W 2 L. */
export function LeagueRecord({ rows, summary }: { rows: RecordRow[]; summary?: string }) {
  const right = rows.reduce((a, x) => a + x.right, 0);
  const wrong = rows.reduce((a, x) => a + x.wrong, 0);

  return (
    <>
      <div className="tc-record">
        {rows.map((row) => <RecordItem row={row} key={row.league} />)}
      </div>

      <div className="tc-record__summary">
        <span className="tc-record__big">
          <b>{right}</b> W <i>{wrong}</i> L
        </span>
        {summary && <p className="tc-lede" style={{ fontSize: "var(--tc-1)" }}>{summary}</p>}
      </div>
    </>
  );
}
