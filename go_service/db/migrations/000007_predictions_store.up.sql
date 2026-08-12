CREATE TABLE IF NOT EXISTS predictions (
    id            SERIAL PRIMARY KEY,
    home_team     TEXT NOT NULL,
    away_team     TEXT NOT NULL,
    league_code   TEXT NOT NULL,
    match_date    DATE NOT NULL,
    prediction    JSONB NOT NULL,
    predicted_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (league_code, match_date, home_team, away_team)
);
-- Fast lookup of "what past dates have predictions for this league"
CREATE INDEX IF NOT EXISTS predictions_league_date_idx ON predictions (league_code, match_date);
