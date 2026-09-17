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

type bankerPick struct {
	Market  string  `json:"market"`
	League  string  `json:"league"`
	Label   string  `json:"label"`
	Detail  string  `json:"detail"`
	Date    string  `json:"date"`
	ProbPct float64 `json:"prob_pct"`
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

	payload := computeConfidentPicks(apiKey, pythonURL)
	out, _ := json.Marshal(payload)
	db.RedisClient.Set(db.Ctx, cacheKey, out, time.Hour)
	return c.Blob(http.StatusOK, "application/json", out)
}

// computeConfidentPicks runs the full cross-league pick computation and returns
// the 8 ranked lists. Shared by the HTTP handler and the weekly snapshot job.
func computeConfidentPicks(apiKey, pythonURL string) map[string]interface{} {
	var overGoals, btts, overCorners, overShots, overFouls []pickMatch
	var wins, teamShots, teamFouls []pickTeam

	pacedMiss := false
	for _, lg := range SupportedLeagues {
		fixtures, err := getConfidentFixtures(lg.Code, apiKey, &pacedMiss)
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
			overFouls = append(overFouls, pickMatch{lg.Name, h, a, date, pr.ProbOver245Fouls})
			teamFouls = append(teamFouls, pickTeam{lg.Name, h, a, date, pr.ProbHomeOver125Fouls})
			teamFouls = append(teamFouls, pickTeam{lg.Name, a, h, date, pr.ProbAwayOver125Fouls})
			// wins: whichever side has the higher win probability
			if pr.HomeWinProbPct >= pr.AwayWinProbPct {
				wins = append(wins, pickTeam{lg.Name, h, a, date, pr.HomeWinProbPct})
			} else {
				wins = append(wins, pickTeam{lg.Name, a, h, date, pr.AwayWinProbPct})
			}
		}
	}

	// BANKER: the 6 highest-probability picks across ALL markets pooled together.
	var banker []bankerPick
	matchMarkets := map[string][]pickMatch{
		"Over 2.5 goals": overGoals, "Both teams to score": btts,
		"Over 8.5 corners": overCorners, "Over 26.5 shots": overShots,
		"Over 24.5 fouls": overFouls,
	}
	for label, rows := range matchMarkets {
		for _, m := range rows {
			banker = append(banker, bankerPick{
				Market: label, League: m.League, Label: label,
				Detail: m.Home + " v " + m.Away, Date: m.Date, ProbPct: m.ProbPct,
			})
		}
	}
	teamMarkets := map[string][]pickTeam{
		"To win": wins, "18+ shots": teamShots, "13+ fouls": teamFouls,
	}
	for label, rows := range teamMarkets {
		for _, t := range rows {
			banker = append(banker, bankerPick{
				Market: label, League: t.League, Label: t.Team + " " + label,
				Detail: "vs " + t.Opponent, Date: t.Date, ProbPct: t.ProbPct,
			})
		}
	}
	sort.Slice(banker, func(i, j int) bool { return banker[i].ProbPct > banker[j].ProbPct })
	if len(banker) > 6 {
		banker = banker[:6]
	}

	return map[string]interface{}{
		"banker":       banker,
		"over_goals":   top5Matches(overGoals),
		"btts":         top5Matches(btts),
		"over_corners": top5Matches(overCorners),
		"over_shots":   top5Matches(overShots),
		"wins":         top5Teams(wins),
		"team_shots":   top5Teams(teamShots),
		"over_fouls":   top5Matches(overFouls),
		"team_fouls":   top5Teams(teamFouls),
	}
}

// SnapshotConfidentPicks computes this week's confident picks and freezes them
// into confident_snapshots for later grading. Idempotent per snapshot_date via
// ON CONFLICT DO NOTHING. Triggered weekly (before matches) by the scheduler.
func SnapshotConfidentPicks(c echo.Context) error {
	apiKey := c.Get("football_api_key").(string)
	pythonURL := c.Get("python_url").(string)
	picks := computeConfidentPicks(apiKey, pythonURL)

	snapDate := time.Now().Format("2006-01-02")
	inserted := 0

	writeMatch := func(market string, rows []pickMatch) {
		for _, m := range rows {
			_, err := db.DB.Exec(
				`INSERT INTO confident_snapshots
				 (snapshot_date, market, league, home_team, away_team, match_date, prob_pct)
				 VALUES ($1,$2,$3,$4,$5,$6,$7)
				 ON CONFLICT DO NOTHING`,
				snapDate, market, m.League, m.Home, m.Away, m.Date, m.ProbPct)
			if err == nil {
				inserted++
			}
		}
	}
	writeTeam := func(market string, rows []pickTeam) {
		for _, t := range rows {
			_, err := db.DB.Exec(
				`INSERT INTO confident_snapshots
				 (snapshot_date, market, league, team, opponent, match_date, prob_pct)
				 VALUES ($1,$2,$3,$4,$5,$6,$7)
				 ON CONFLICT DO NOTHING`,
				snapDate, market, t.League, t.Team, t.Opponent, t.Date, t.ProbPct)
			if err == nil {
				inserted++
			}
		}
	}

	// helper: cast the interface{} lists back to their concrete types
	if v, ok := picks["over_goals"].([]pickMatch); ok {
		writeMatch("over_goals", v)
	}
	if v, ok := picks["btts"].([]pickMatch); ok {
		writeMatch("btts", v)
	}
	if v, ok := picks["over_corners"].([]pickMatch); ok {
		writeMatch("over_corners", v)
	}
	if v, ok := picks["over_shots"].([]pickMatch); ok {
		writeMatch("over_shots", v)
	}
	if v, ok := picks["over_fouls"].([]pickMatch); ok {
		writeMatch("over_fouls", v)
	}
	if v, ok := picks["wins"].([]pickTeam); ok {
		writeTeam("wins", v)
	}
	if v, ok := picks["team_shots"].([]pickTeam); ok {
		writeTeam("team_shots", v)
	}
	if v, ok := picks["team_fouls"].([]pickTeam); ok {
		writeTeam("team_fouls", v)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"snapshot_date": snapDate, "inserted": inserted,
	})
}

// getConfidentFixtures reads a league's fixtures from the same Redis cache the
// /fixtures endpoint populates (key "fixtures:<code>"), avoiding a fresh API call.
// On a cache miss it fetches from football-data.org, but PACES misses (6s apart)
// so the rapid all-league loop never trips football-data.org's ~10 req/min limit
// (which was silently dropping late-order leagues like DED/PPL from the picks).
func getConfidentFixtures(code, apiKey string, pacedMiss *bool) ([]models.Fixture, error) {
	// try the cached /fixtures payload first
	if cached, err := db.RedisClient.Get(db.Ctx, "fixtures:"+code).Result(); err == nil {
		var payload struct {
			Fixtures []models.Fixture `json:"fixtures"`
		}
		if json.Unmarshal([]byte(cached), &payload) == nil && len(payload.Fixtures) > 0 {
			return payload.Fixtures, nil
		}
	}
	// cache miss: always pace before hitting football-data.org so a burst of
	// misses never trips its ~10 req/min limit (which was randomly dropping
	// whichever leagues happened to fetch last). 7s between fetches = ~8/min.
	if *pacedMiss {
		time.Sleep(7 * time.Second)
	}
	*pacedMiss = true
	fx, err := fetchFootballDataOrg(code, apiKey)
	if err == nil && len(fx) > 0 {
		// warm the shared fixtures cache so the next compute (and the /fixtures
		// endpoint) reuse it instead of re-fetching.
		if b, mErr := json.Marshal(map[string]interface{}{"fixtures": fx}); mErr == nil {
			db.RedisClient.Set(db.Ctx, "fixtures:"+code, b, 20*time.Minute)
		}
	}
	return fx, err
}
