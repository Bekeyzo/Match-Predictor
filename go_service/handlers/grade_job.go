package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"match-predictor/db"

	"github.com/labstack/echo/v4"
)

// normTeam lowercases and strips common suffixes so a stored prediction's
// team name matches football-data.org's finished-match name.
func normTeam(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	for _, suf := range []string{" fc", " afc", " cf", " sc"} {
		s = strings.TrimSuffix(s, suf)
	}
	return strings.TrimSpace(s)
}

type finishedMatch struct {
	home, away         string
	homeGoals, awayGoals int
}

// fetchFinished pulls this league's FINISHED matches from football-data.org.
func fetchFinished(leagueCode, apiKey string) (map[string]finishedMatch, error) {
	url := fmt.Sprintf(
		"https://api.football-data.org/v4/competitions/%s/matches?status=FINISHED",
		leagueCode,
	)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("X-Auth-Token", apiKey)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var body struct {
		Matches []struct {
			UtcDate  string `json:"utcDate"`
			HomeTeam struct{ Name string `json:"name"` } `json:"homeTeam"`
			AwayTeam struct{ Name string `json:"name"` } `json:"awayTeam"`
			Score    struct {
				FullTime struct {
					Home *int `json:"home"`
					Away *int `json:"away"`
				} `json:"fullTime"`
			} `json:"score"`
		} `json:"matches"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, err
	}

	out := map[string]finishedMatch{}
	for _, m := range body.Matches {
		if m.Score.FullTime.Home == nil || m.Score.FullTime.Away == nil {
			continue
		}
		date := m.UtcDate
		if len(date) >= 10 {
			date = date[:10]
		}
		key := date + "|" + normTeam(m.HomeTeam.Name) + "|" + normTeam(m.AwayTeam.Name)
		out[key] = finishedMatch{
			home: m.HomeTeam.Name, away: m.AwayTeam.Name,
			homeGoals: *m.Score.FullTime.Home, awayGoals: *m.Score.FullTime.Away,
		}
	}
	return out, nil
}

// GradeLeague grades all ungraded past predictions for a league.
func GradeLeague(c echo.Context) error {
	league := c.QueryParam("league")
	if league == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "league required"})
	}
	apiKey, _ := c.Get("football_api_key").(string)

	finished, err := fetchFinished(league, apiKey)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "fetch finished failed: " + err.Error()})
	}

	rows, err := db.DB.Query(
		`SELECT id, home_team, away_team, match_date, prediction FROM predictions
		 WHERE league_code = $1 AND verdict IS NULL AND match_date < CURRENT_DATE`,
		league,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "query failed"})
	}
	defer rows.Close()

	type pend struct {
		id             int
		home, away     string
		date           string
		pred           json.RawMessage
	}
	var pending []pend
	for rows.Next() {
		var p pend
		var raw []byte
		var d string
		if rows.Scan(&p.id, &p.home, &p.away, &d, &raw) == nil {
			if len(d) >= 10 {
				d = d[:10]
			}
			p.date = d
			p.pred = json.RawMessage(raw)
			pending = append(pending, p)
		}
	}

	graded, right, wrong := 0, 0, 0
	for _, p := range pending {
		key := p.date + "|" + normTeam(p.home) + "|" + normTeam(p.away)
		fm, ok := finished[key]
		if !ok {
			continue // no finished result yet (or name/date mismatch) — leave pending
		}
		pick, _ := StrongPick(p.pred)
		correct := GradePick(pick, fm.homeGoals, fm.awayGoals)
		verdict := "wrong"
		if correct {
			verdict = "right"
		}
		result, _ := json.Marshal(map[string]interface{}{
			"home_goals": fm.homeGoals, "away_goals": fm.awayGoals, "pick": pick,
		})
		_, _ = db.DB.Exec(
			`UPDATE predictions SET verdict = $1, result = $2 WHERE id = $3`,
			verdict, result, p.id,
		)
		graded++
		if correct {
			right++
		} else {
			wrong++
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"league": league, "graded": graded, "right": right, "wrong": wrong,
		"pending": len(pending) - graded,
	})
}
