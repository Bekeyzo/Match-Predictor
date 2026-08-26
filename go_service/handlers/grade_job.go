package handlers

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"match-predictor/db"

	"github.com/labstack/echo/v4"
)

// teamAliases maps org long names to the football-data.co.uk short names,
// so the grader can match a stored prediction to its finished result.
// Duplicates Python resolve_team's pins (python_service/predictor.py) — keep
// in sync until predictions store the resolved short name. Keys are written
// post lowercase+suffix-strip. PSG -> paris sg, never paris fc (different club).
var teamAliases = map[string]string{
	"olympique de marseille": "marseille",
	"paris saint-germain": "paris sg",
	"rc strasbourg alsace": "strasbourg",
	"stade rennais 1901": "rennes",
	"sc cambuur-leeuwarden": "cambuur",
	"feyenoord rotterdam": "feyenoord",
	"sbv excelsior": "excelsior",
	"nec": "nijmegen",
	"sporting clube de braga": "sp braga",
}

// normTeam lowercases, strips suffixes, then applies the alias map.
func normTeam(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	for _, suf := range []string{" fc", " afc", " cf", " sc"} {
		s = strings.TrimSuffix(s, suf)
	}
	s = strings.TrimSpace(s)
	if alias, ok := teamAliases[s]; ok {
		return alias
	}
	return s
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

// lookupWithinADay finds a finished result for the given home|away pair on the
// stored date, or +/- 1 day. Home/away must match EXACTLY (same orientation) —
// only the date flexes. This absorbs UTC-vs-local kickoff rollover (e.g. a late
// game football-data.org dates 08-22 that co.uk records as 08-21) WITHOUT ever
// matching a reversed fixture or a different game. Off by >1 day, or home/away
// swapped, stays unmatched (pending) — we never guess a verdict.
func lookupWithinADay(finished map[string]finishedMatch, dateStr, home, away string) (finishedMatch, bool) {
	base, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		// fall back to exact-key lookup if the date can't be parsed
		fm, ok := finished[dateStr+"|"+home+"|"+away]
		return fm, ok
	}
	for _, delta := range []int{0, -1, 1} {
		d := base.AddDate(0, 0, delta).Format("2006-01-02")
		if fm, ok := finished[d+"|"+home+"|"+away]; ok {
			return fm, true
		}
	}
	return finishedMatch{}, false
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
		finished = nil // org failed; try the co.uk fallback below
	}
	if len(finished) == 0 {
		if alt, altErr := fetchFinishedCoUk(league); altErr == nil && len(alt) > 0 {
			finished = alt
		}
	}
	if len(finished) == 0 {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"league": league, "graded": 0, "right": 0, "wrong": 0,
			"pending": 0, "note": "no finished results available for this league yet",
		})
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
		fm, ok := lookupWithinADay(finished, p.date, normTeam(p.home), normTeam(p.away))
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

// coUkSeason returns football-data.co.uk's season code, e.g. "2526" for 2025-26.
// Their season starts in July; before July we're still in the season that began
// the previous calendar year.
func coUkSeason(now time.Time) string {
	y := now.Year() % 100
	if now.Month() < time.July {
		// e.g. Feb 2026 -> season 2025-26 -> "2526"
		return fmt.Sprintf("%02d%02d", y-1, y)
	}
	// e.g. Aug 2026 -> season 2026-27 -> "2627"
	return fmt.Sprintf("%02d%02d", y, y+1)
}

// fetchFinishedCoUk pulls finished results from football-data.co.uk's per-season
// results CSV (/mmz4281/<season>/<div>.csv), which carries FTHG/FTAG columns.
// Used for leagues football-data.org doesn't cover (Greece, Belgium, etc.).
func fetchFinishedCoUk(leagueCode string) (map[string]finishedMatch, error) {
	div, ok := footballDataCoUkDiv[leagueCode]
	if !ok {
		return nil, fmt.Errorf("no football-data.co.uk div for %s", leagueCode)
	}
	url := fmt.Sprintf("https://www.football-data.co.uk/mmz4281/%s/%s.csv", coUkSeason(time.Now()), div)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; TehutiBot/1.0)")
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("results csv returned %d", resp.StatusCode)
	}

	out := map[string]finishedMatch{}
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)

	// find columns by header name (the file has ~130 columns)
	var idxDate, idxHome, idxAway, idxFTHG, idxFTAG = -1, -1, -1, -1, -1
	first := true
	for scanner.Scan() {
		line := strings.TrimRight(scanner.Text(), "\r")
		cols := strings.Split(line, ",")
		if first {
			first = false
			for i, name := range cols {
				switch strings.TrimSpace(name) {
				case "Date":
					idxDate = i
				case "HomeTeam":
					idxHome = i
				case "AwayTeam":
					idxAway = i
				case "FTHG":
					idxFTHG = i
				case "FTAG":
					idxFTAG = i
				}
			}
			if idxDate < 0 || idxHome < 0 || idxAway < 0 || idxFTHG < 0 || idxFTAG < 0 {
				return nil, fmt.Errorf("results csv missing expected columns")
			}
			continue
		}
		if len(cols) <= idxFTAG {
			continue
		}
		hg, err1 := strconv.Atoi(strings.TrimSpace(cols[idxFTHG]))
		ag, err2 := strconv.Atoi(strings.TrimSpace(cols[idxFTAG]))
		if err1 != nil || err2 != nil {
			continue // unplayed game (blank goals)
		}
		// Date is dd/mm/yyyy (occasionally dd/mm/yy)
		dateStr := strings.TrimSpace(cols[idxDate])
		t, err := time.Parse("02/01/2006", dateStr)
		if err != nil {
			if t, err = time.Parse("02/01/06", dateStr); err != nil {
				continue
			}
		}
		date := t.Format("2006-01-02")
		home := strings.TrimSpace(cols[idxHome])
		away := strings.TrimSpace(cols[idxAway])
		key := date + "|" + normTeam(home) + "|" + normTeam(away)
		out[key] = finishedMatch{home: home, away: away, homeGoals: hg, awayGoals: ag}
	}
	return out, nil
}
