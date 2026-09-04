// The published figures the homepage is built on, in one place.
// Hard coded on purpose for the first deploy: these numbers are already
// public, and the page should not go blank when the API is slow.
// Swap each block for a live call when ready. Shapes match the endpoints.

export type BoardRow = { league: string; right: number; wrong: number };
export type RecordRow = BoardRow & { note?: string };

/** GET /accuracy */
export const ACCURACY = {
  overallPct: 47.1,
  baselinePct: 43.4,
  edgePts: 3.7,
  matchesTested: 5862,
  professionalRange: "50 - 55%",
  strongest: [
    { league: "Scottish Premiership", pct: 56.1 },
    { league: "Greek Super League", pct: 55.5 },
    { league: "Primeira Liga", pct: 54.2 },
  ],
};

/** POST /grade tallies grouped by league. Sums to 45 W 23 L. */
export const RECORD: RecordRow[] = [
  { league: "Premier League",     right: 8,  wrong: 1, note: "Best week of the round" },
  { league: "La Liga",            right: 10, wrong: 2, note: "Most fixtures graded" },
  { league: "Primeira Liga",      right: 6,  wrong: 0, note: "Clean sweep, small sample" },
  { league: "Championship",       right: 8,  wrong: 3, note: "Holds up despite the churn" },
  { league: "Serie A",            right: 5,  wrong: 3, note: "Draw heavy, as usual" },
  { league: "Eredivisie",         right: 1,  wrong: 0, note: "Barely graded yet" },
  { league: "Ligue 1",            right: 4,  wrong: 5, note: "Losing week" },
  { league: "Segunda Division",   right: 2,  wrong: 5, note: "Thin data, plenty of upsets" },
  { league: "Ligue 2",            right: 1,  wrong: 1, note: "Even split" },
  { league: "2. Bundesliga",      right: 0,  wrong: 2, note: "Nothing landed" },
  { league: "Belgian Pro League", right: 0,  wrong: 1, note: "One call, missed" },
];

/** Keep the hero board at six rows. Seven overflows the ticks at 1280. */
export const BOARD: BoardRow[] = RECORD.slice(0, 6).map(({ league, right, wrong }) => ({
  league, right, wrong,
}));

export const RECORD_TOTALS = {
  right: RECORD.reduce((a, r) => a + r.right, 0),
  wrong: RECORD.reduce((a, r) => a + r.wrong, 0),
};

export const MARKETS = [
  { kind: "Result",    name: "Home, draw, away",    body: "Logistic regression on form, goals scored and conceded, and venue." },
  { kind: "Goals",     name: "Over 1.5, 2.5, 3.5",  body: "Poisson probabilities read straight off the scoreline grid." },
  { kind: "Goals",     name: "Both teams to score", body: "Joint probability that neither side is kept off the scoresheet." },
  { kind: "Scoreline", name: "Most likely score",   body: "The single highest cell in the grid, with its own probability." },
  { kind: "Shape",     name: "Expected goals",      body: "Attack and defence strength for both sides, recent form weighted." },
  { kind: "Verdict",   name: "The strongest call",  body: "The highest probability across every market, tiered by how far clear it sits." },
];

export const METHOD = [
  { step: "Train",  when: "Monday and Thursday",
    body: "Five seasons of completed matches plus everything played so far this season, refitted twice a week so the model keeps up with form." },
  { step: "Freeze", when: "Before kickoff",
    body: "The first split generated for a fixture is written down and never recomputed. Re-predicting a played match would let its own result leak in." },
  { step: "Grade",  when: "After full time",
    body: "The frozen call is checked against the final score, marked, and added to the league tally. Wrong calls stay on the matchday they were made." },
];
