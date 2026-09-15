package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"sort"
	"time"

	"match-predictor/db"
	"match-predictor/models"

	"github.com/labstack/echo/v4"
)

type pickMatch struct {
	League  string  `json:"league"`
	Home    string  `json:"home"`
	Away    string  `json:"away"`
	Date    string  `json:"date"`
	ProbPct float64 `json:"prob_pct"`
}
type pickTeam struct {
	League   string  `json:"league"`
	Team     string  `json:"team"`
	Opponent string  `json:"opponent"`
	Date     string  `json:"date"`
	ProbPct  float64 `json:"prob_pct"`
}

func top5Matches(m []pickMatch) []pickMatch {
	sort.Slice(m, func(i, j int) bool { return m[i].ProbPct > m[j].ProbPct })
	if len(m) > 5 {
		return m[:5]
	}
	return m
}
func top5Teams(t []pickTeam) []pickTeam {
	sort.Slice(t, func(i, j int) bool { return t[i].ProbPct > t[j].ProbPct })
	if len(t) > 5 {
		return t[:5]
	}
	return t
}

// GetConfidentShots ranks, across every league's current matchweek, the top 5
// matches and teams for each market (goals, BTTS, corners, shots, wins). Heavy
// (loops all fixtures × predict), so cached 1h. Gated.
func GetConfidentShots(c echo.Context) error {
	var verified bool
	db.DB.QueryRow("SELECT verified FROM users WHERE id = $1", c.Get("user_id")).Scan(&verified)
	if !verified {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "unverified", "message": "Please verify your email to see confident picks.",
		})
	}

	const cacheKey = "confident_picks:v2"
	if cached, err := db.RedisClient.Get(db.Ctx, cacheKey).Result(); err == nil {
		return c.Blob(http.StatusOK, "application/json", []byte(cached))
	}

	apiKey := c.Get("football_api_key").(string)
	pythonURL := c.Get("python_url").(string)

	var overGoals, btts, overCorners, overShots []pickMatch
	var wins, teamShots []pickTeam

	for _, lg := range SupportedLeagues {
		fixtures, err := fetchFootballDataOrg(lg.Code, apiKey)
		if err != nil || len(fixtures) == 0 {
			continue
		}
		fixtures = firstMatchweek(fixtures)
		for _, fx := range fixtures {
			home := fx.HomeTeam.Name
			away := fx.AwayTeam.Name
			date := ""
			if len(fx.UtcDate) >= 10 {
				date = fx.UtcDate[:10]
			}
			body, _ := json.Marshal(map[string]string{
				"home_team": home, "away_team": away,
				"league_code": lg.Code, "match_date": date,
			})
			resp, err := http.Post(pythonURL+"/predict", "application/json", bytes.NewBuffer(body))
			if err != nil {
				continue
			}
			var pr models.PredictionResult
			derr := json.NewDecoder(resp.Body).Decode(&pr)
			resp.Body.Close()
			if derr != nil {
				continue
			}
			if (pr.StaleData != nil && *pr.StaleData) || (pr.InsufficientData != nil && *pr.InsufficientData) {
				continue
			}
			h, a := pr.HomeTeam, pr.AwayTeam
			overGoals = append(overGoals, pickMatch{lg.Name, h, a, date, pr.ProbOver25Pct})
			btts = append(btts, pickMatch{lg.Name, h, a, date, pr.BttprobPct})
			overCorners = append(overCorners, pickMatch{lg.Name, h, a, date, pr.ProbOver85Corners})
			overShots = append(overShots, pickMatch{lg.Name, h, a, date, pr.ProbOver265Shots})
			teamShots = append(teamShots, pickTeam{lg.Name, h, a, date, pr.ProbHomeOver185Shots})
			teamShots = append(teamShots, pickTeam{lg.Name, a, h, date, pr.ProbAwayOver185Shots})
			// wins: whichever side has the higher win probability
			if pr.HomeWinProbPct >= pr.AwayWinProbPct {
				wins = append(wins, pickTeam{lg.Name, h, a, date, pr.HomeWinProbPct})
			} else {
				wins = append(wins, pickTeam{lg.Name, a, h, date, pr.AwayWinProbPct})
			}
		}
	}

	payload := map[string]interface{}{
		"over_goals":   top5Matches(overGoals),
		"btts":         top5Matches(btts),
		"over_corners": top5Matches(overCorners),
		"over_shots":   top5Matches(overShots),
		"wins":         top5Teams(wins),
		"team_shots":   top5Teams(teamShots),
	}
	out, _ := json.Marshal(payload)
	db.RedisClient.Set(db.Ctx, cacheKey, out, time.Hour)
	return c.Blob(http.StatusOK, "application/json", out)
}
