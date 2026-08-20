package handlers

import (
	"encoding/json"
	"fmt"
)

// StrongPick returns the highest-probability outcome across ALL markets
// (1X2 + over/under + BTTS) as a stable label plus its probability.
func StrongPick(pred json.RawMessage) (string, float64) {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(pred, &raw); err != nil {
		return "", 0
	}
	p := map[string]float64{}
	for k, v := range raw {
		var f float64
		if json.Unmarshal(v, &f) == nil {
			p[k] = f
		}
	}
	candidates := []struct {
		label string
		prob  float64
	}{
		{"home", p["home_win_prob_pct"]},
		{"draw", p["draw_prob_pct"]},
		{"away", p["away_win_prob_pct"]},
		{"over_1_5", p["prob_over_1_5_pct"]},
		{"over_2_5", p["prob_over_2_5_pct"]},
		{"over_3_5", p["prob_over_3_5_pct"]},
		{"btts", p["btts_prob_pct"]},
	}
	best := ""
	bestProb := -1.0
	for _, c := range candidates {
		if c.prob > bestProb {
			bestProb = c.prob
			best = c.label
		}
	}
	return best, bestProb
}

// GradePick decides whether a strong-pick label came true given the final score.
func GradePick(pick string, homeGoals, awayGoals int) bool {
	total := homeGoals + awayGoals
	switch pick {
	case "home":
		return homeGoals > awayGoals
	case "away":
		return awayGoals > homeGoals
	case "draw":
		return homeGoals == awayGoals
	case "over_1_5":
		return total > 1
	case "over_2_5":
		return total > 2
	case "over_3_5":
		return total > 3
	case "btts":
		return homeGoals > 0 && awayGoals > 0
	}
	return false
}

// PickLabel turns a stored pick code into a human-readable phrase.
func PickLabel(pick, home, away string) string {
	switch pick {
	case "home":
		return fmt.Sprintf("%s to win", home)
	case "away":
		return fmt.Sprintf("%s to win", away)
	case "draw":
		return "Draw"
	case "over_1_5":
		return "Over 1.5 goals"
	case "over_2_5":
		return "Over 2.5 goals"
	case "over_3_5":
		return "Over 3.5 goals"
	case "btts":
		return "Both teams to score"
	}
	return pick
}
