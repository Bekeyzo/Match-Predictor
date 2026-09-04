// Homepage in Direction C. Server component: only the animated pieces are
// client islands, so almost no JS ships above the fold.
// The <header> is the shape the direction expects. Either restyle NavAuth
// with the .tc-nav classes, or drop <NavAuth /> where the button sits.

import Link from "next/link";
import { CountUp } from "../components/CountUp";
import { LeagueRecord } from "../components/LeagueRecord";
import { Reveal } from "../components/Reveal";
import { ScoreBoard } from "../components/ScoreBoard";
import { ACCURACY, BOARD, MARKETS, METHOD, RECORD } from "../lib/home-data";

export default function HomePage() {
  return (
    <div className="tc-page">
      <div>
        <section style={{ padding: "clamp(2.5rem,5.5vw,4.5rem) 0 clamp(2.5rem,5vw,4rem)" }}>
          <div className="tc-wrap tc-hero-grid">
            <div>
              <h1 className="tc-h1">
                We keep score<br />on <span style={{ color: "var(--accent)" }}>ourselves</span>.
              </h1>
              <p className="tc-lede" style={{ marginTop: "1.4rem", maxWidth: "36ch" }}>
                A football model that predicts fourteen leagues, then publishes
                every call it got wrong next to every call it got right.
              </p>
              <div style={{ marginTop: "2rem", display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
                <Link className="tc-btn tc-btn--solid tc-btn--lg" href="/leagues">Open the model</Link>
                <Link className="tc-btn tc-btn--line tc-btn--lg" href="#record">See the record</Link>
              </div>
            </div>

            <ScoreBoard
              rows={BOARD}
              totalRight={45}
              totalWrong={23}
              footnote="Six of the eleven leagues in the round. Each mark is one fixture where the model's strongest call was checked against the final score."
            />
          </div>
        </section>

        <section style={{ background: "var(--paper-2)", borderBlock: "2px solid var(--ink)" }}>
          <div className="tc-wrap tc-sec tc-acc-grid">
            <div className="tc-figure">
              <CountUp to={ACCURACY.overallPct} className="tc-figure__n" />
              <span className="tc-figure__u">%</span>
            </div>
            <div>
              <h2 className="tc-h3" style={{ maxWidth: "20ch" }}>
                Correct result, on matches it had never seen
              </h2>
              <p style={{ marginTop: ".8rem", color: "var(--ink-2)", maxWidth: "46ch" }}>
                Measured across {ACCURACY.matchesTested.toLocaleString("en-GB")} held-out
                fixtures. Picking the home side every single time gets you {ACCURACY.baselinePct} percent,
                so the honest claim is a few points of edge, not a crystal ball.
              </p>
              <div className="tc-compare" style={{ marginTop: "1.5rem" }}>
                <div>
                  <span className="tc-compare__v">{ACCURACY.baselinePct}%</span>
                  <span className="tc-compare__k">Always pick home</span>
                </div>
                <div className="is-up">
                  <span className="tc-compare__v">{ACCURACY.overallPct}%</span>
                  <span className="tc-compare__k">Tehuti</span>
                </div>
                <div className="is-up">
                  <span className="tc-compare__v">+{ACCURACY.edgePts}</span>
                  <span className="tc-compare__k">Points of edge</span>
                </div>
                <div>
                  <span className="tc-compare__v">{ACCURACY.professionalRange}</span>
                  <span className="tc-compare__k">Professional range</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="tc-sec" id="record">
          <div className="tc-wrap">
            <Reveal as="h2"><span className="tc-h2">Every league reports its own week, good or bad</span></Reveal>
            <Reveal>
              <p className="tc-lede" style={{ marginTop: ".9rem", marginBottom: "2.5rem" }}>
                Green is a call that landed. Red is one that did not. The second tiers
                are the worst of them, and they are printed at the same size as the
                Premier League.
              </p>
            </Reveal>

            <LeagueRecord
              rows={RECORD}
              summary="Sixty eight graded calls in the round. Nothing was dropped from the tally for looking bad, and the weakest leagues stayed in."
            />
          </div>
        </section>

        <section className="tc-sec" id="markets" style={{ paddingTop: 0 }}>
          <div className="tc-wrap">
            <Reveal as="h2"><span className="tc-h2">Six questions per fixture</span></Reveal>
            <Reveal>
              <p className="tc-lede" style={{ marginTop: ".9rem", marginBottom: "2.25rem" }}>
                The match page answers all of them, then endorses whichever is
                strongest. Often that is a goals line rather than the winner.
              </p>
            </Reveal>
            <div className="tc-rail">
              {MARKETS.map((m) => (
                <div className="tc-rail__card" key={m.name}>
                  <span className="tc-rail__q">{m.kind}</span>
                  <h3 className="tc-h3" style={{ fontSize: "var(--tc1)" }}>{m.name}</h3>
                  <p>{m.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="tc-sec" id="method" style={{ paddingTop: 0 }}>
          <div className="tc-wrap">
            <Reveal as="h2"><span className="tc-h2">Train, freeze, grade</span></Reveal>
            <Reveal>
              <p className="tc-lede" style={{ marginTop: ".9rem", marginBottom: "2.5rem" }}>
                The freeze is the part that makes the record mean anything. A
                prediction that can be edited after kickoff is not a prediction.
              </p>
            </Reveal>
            <div className="tc-method">
              {METHOD.map((m) => (
                <div className="tc-method__col" key={m.step}>
                  <h3 className="tc-h3">{m.step}</h3>
                  <div className="tc-method__when">{m.when}</div>
                  <p>{m.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="tc-panel" style={{ padding: "clamp(3.5rem,7vw,5.5rem) 0" }}>
          <div className="tc-wrap tc-close-grid">
            <div>
              <h2 className="tc-h1" style={{ maxWidth: "14ch" }}>This week is already on the board.</h2>
              <Link className="tc-btn tc-btn--onpanel tc-btn--lg" href="/leagues" style={{ marginTop: "2rem" }}>
                Open the model
              </Link>
            </div>
            <p style={{ color: "var(--panel-2)", fontSize: "var(--tc-1)", borderLeft: "2px solid var(--accent)", paddingLeft: "1rem", maxWidth: "36ch" }}>
              Tehuti publishes model output for analysis and study. It is not betting
              advice, and it sells no tips.
            </p>
          </div>
        </section>
      </div>

    </div>
  );
}

/** The reading eye, drawn rather than loaded, so it inherits the theme. */
function TehutiMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="var(--accent)" strokeWidth="2" />
      <path d="M4 13.2c2.6 2.6 5.3 3.9 8 3.9s5.4-1.3 8-3.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 12.4c1.5-3.4 3-5.1 4.6-5.1 1.5 0 2.6 1.1 3.4 3.2" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
