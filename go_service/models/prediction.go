package models

type PredictionRequest struct {
	HomeTeam   string `json:"home_team"`
	AwayTeam   string `json:"away_team"`
	MatchDate  string `json:"match_date"`
	LeagueCode string `json:"league_code"`
}

type PredictionResult struct {
	Fixture                string  `json:"fixture"`
	HomeTeam               string  `json:"home_team"`
	AwayTeam               string  `json:"away_team"`
	PredictedResult        string  `json:"predicted_result"`
	HomeWinProbPct         float64 `json:"home_win_prob_pct"`
	DrawProbPct            float64 `json:"draw_prob_pct"`
	AwayWinProbPct         float64 `json:"away_win_prob_pct"`
	ExpectedHomeGoals      float64 `json:"expected_home_goals"`
	ExpectedAwayGoals      float64 `json:"expected_away_goals"`
	MostLikelyScore        string  `json:"most_likely_score"`
	ProbMostLikelyScorePct float64 `json:"prob_most_likely_score_pct"`
	BttprobPct             float64 `json:"btts_prob_pct"`
	ExpectedTotalGoals     float64 `json:"expected_total_goals"`
	ProbOver25Pct          float64 `json:"prob_over_2_5_pct"`
	ExpectedHomeCorners    float64 `json:"expected_home_corners"`
	ExpectedAwayCorners    float64 `json:"expected_away_corners"`
	ExpectedTotalCorners   float64 `json:"expected_total_corners"`
	ExpectedHomeCards      float64 `json:"expected_home_cards"`
	ExpectedAwayCards      float64 `json:"expected_away_cards"`
	ExpectedTotalCards     float64 `json:"expected_total_cards"`
}
