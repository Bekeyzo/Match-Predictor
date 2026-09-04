"use client";

import { useInView } from "./useInView";

export type SplitBarProps = {
  home: number;   // home_win_prob_pct
  draw: number;   // draw_prob_pct
  away: number;   // away_win_prob_pct
  homeTeam?: string;
  awayTeam?: string;
  league?: string;
  size?: "lg" | "sm";
  showLegend?: boolean;
};

/** The three way probability split.
 *  Colours come from --split-h/d/a, never --home/--draw/--away. Those stay
 *  reserved for W/D/L form and the right/wrong verdict, so a green segment
 *  can never be mistaken for a correct call.
 *  Values are normalised, not trusted to reach 100: each market rounds alone. */
export function SplitBar({
  home, draw, away, homeTeam, awayTeam, league,
  size = "lg", showLegend = true,
}: SplitBarProps) {
  const [ref, inView] = useInView<HTMLDivElement>(0.4);

  const total = Math.max(home + draw + away, 1);
  const pct = (v: number) => `${(v / total) * 100}%`;
  const width = (v: number) => (inView ? pct(v) : "0%");
  const showHead = Boolean(homeTeam || awayTeam || league);

  return (
    <div ref={ref}>
      {showHead && (
        <div className="tc-split__head">
          <div className="tc-split__teams">
            {homeTeam}
            {homeTeam && awayTeam && <span className="v">v</span>}
            {awayTeam}
          </div>
          {league && <span className="tc-label">{league}</span>}
        </div>
      )}

      <div
        className={`tc-split__bar${size === "sm" ? " tc-split__bar--sm" : ""}`}
        role="img"
        aria-label={`Home ${Math.round(home)} percent, draw ${Math.round(draw)} percent, away ${Math.round(away)} percent`}
      >
        <span className="tc-split__seg--h" style={{ width: width(home) }} />
        <span className="tc-split__seg--d" style={{ width: width(draw) }} />
        <span className="tc-split__seg--a" style={{ width: width(away) }} />
      </div>

      {showLegend && (
        <div className="tc-split__legend">
          <div className="tc-split__leg">
            <span className="tc-split__k">Home</span>
            <span className="tc-split__n">{Math.round(home)}%</span>
          </div>
          <div className="tc-split__leg tc-split__leg--d">
            <span className="tc-split__k">Draw</span>
            <span className="tc-split__n">{Math.round(draw)}%</span>
          </div>
          <div className="tc-split__leg tc-split__leg--a">
            <span className="tc-split__k">Away</span>
            <span className="tc-split__n">{Math.round(away)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
