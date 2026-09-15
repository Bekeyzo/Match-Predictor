CREATE TABLE IF NOT EXISTS confident_snapshots (
    id             SERIAL PRIMARY KEY,
    snapshot_date  DATE NOT NULL,
    market         TEXT NOT NULL,
    league         TEXT NOT NULL,
    home_team      TEXT,
    away_team      TEXT,
    team           TEXT,
    opponent       TEXT,
    match_date     DATE NOT NULL,
    prob_pct       REAL NOT NULL,
    verdict        TEXT,
    actual         TEXT,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (snapshot_date, market, league, home_team, away_team, team, match_date)
);
-- Fast lookup of a given snapshot week, and of ungraded rows for the grader
CREATE INDEX IF NOT EXISTS confident_snapshot_date_idx ON confident_snapshots (snapshot_date);
CREATE INDEX IF NOT EXISTS confident_ungraded_idx ON confident_snapshots (verdict) WHERE verdict IS NULL;
