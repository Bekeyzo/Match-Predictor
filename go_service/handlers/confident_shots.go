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

type shotMatch struct {
	League   string  `json:"league"`
	Home     string  `json:"home"`
	Away     string  `json:"away"`
	Date     string  `json:"date"`
	ProbPct  float64 `json:"prob_pct"`
}
type shotTeam struct {
	League   string  `json:"league"`
	Team     string  `json:"team"`
	Opponent string  `json:"opponent"`
	Date     string  `json:"date"`
	ProbPct  float64 `json:"prob_pct"`
}

// GetConfidentShots ranks, across every league's current matchweek, the 5 matches
// most likely to exceed 26.5 total shots and the 5 teams most likely to exceed
// 18.5 shots. Heavy (loops all fixtures × predict), so cached 1h. Gated.
func GetConfidentShots(c echo.Context) error {
	var verified bool
	db.DB.QueryRow("SELECT verified FROM users WHERE id = $1", c.Get("user_id")).Scan(&verified)
	if !verified {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "unverified", "message": "Please verify your email to see confident picks.",
		})
	}

	const cacheKey = "confident_shots:v1"
	if cached, err := db.RedisClient.Get(db.Ctx, cacheKey).Result(); err == nil {
		return c.Blob(http.StatusOK, "application/json", []byte(cached))
	}

	apiKey := c.Get("football_api_key").(string)
	pythonURL := c.Get("python_url").(string)

	var matches []shotMatch
	var teams []shotTeam

	for _, lg := range SupportedLeagues {
		fixtures, err := fetchFootballDataOrg(lg.Code, apiKey)
		if err != nil || len(fixtures) == 0 {
			continue
		}
		// one matchweek: earliest cluster (stop at first >3-day gap), upcoming only
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
			if pr.StaleData != nil && *pr.StaleData {
				continue
			}
			if pr.InsufficientData != nil && *pr.InsufficientData {
				continue
			}
			matches = append(matches, shotMatch{lg.Name, pr.HomeTeam, pr.AwayTeam, date, pr.ProbOver265Shots})
			teams = append(teams, shotTeam{lg.Name, pr.HomeTeam, pr.AwayTeam, date, pr.ProbHomeOver185Shots})
			teams = append(teams, shotTeam{lg.Name, pr.AwayTeam, pr.HomeTeam, date, pr.ProbAwayOver185Shots})
		}
	}

	sort.Slice(matches, func(i, j int) bool { return matches[i].ProbPct > matches[j].ProbPct })
	sort.Slice(teams, func(i, j int) bool { return teams[i].ProbPct > teams[j].ProbPct })
	if len(matches) > 5 {
		matches = matches[:5]
	}
	if len(teams) > 5 {
		teams = teams[:5]
	}

	payload := map[string]interface{}{"matches": matches, "teams": teams}
	out, _ := json.Marshal(payload)
	db.RedisClient.Set(db.Ctx, cacheKey, out, time.Hour)
	return c.Blob(http.StatusOK, "application/json", out)
}
