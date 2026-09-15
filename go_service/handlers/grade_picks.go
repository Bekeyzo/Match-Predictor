package handlers

import (
	"bufio"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"match-predictor/db"

	"github.com/labstack/echo/v4"
)

// fullResult holds every stat the confident-picks grader needs from co.uk.
type fullResult struct {
	home, away                         string
	hg, ag, hc, ac, hs, as, hf, af     int
	ftr                                string // 'H','D','A'
}

// fetchFullResultsCoUk reads co.uk's results CSV for a league, extracting goals,
// corners, shots, fouls, and the result — keyed date|normHome|normAway.
func fetchFullResultsCoUk(leagueCode string) (map[string]fullResult, error) {
	div, ok := footballDataCoUkDiv[leagueCode]
	if !ok {
		return nil, fmt.Errorf("no co.uk div for %s", leagueCode)
	}
	url := fmt.Sprintf("https://football-data.co.uk/mmz4281/%s/%s.csv", coUkSeason(time.Now()), div)
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

	out := map[string]fullResult{}
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)

	idx := map[string]int{}
	want := []string{"Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR", "HC", "AC", "HS", "AS", "HF", "AF"}
	first := true
	for scanner.Scan() {
		line := strings.TrimRight(scanner.Text(), "\r")
		cols := strings.Split(line, ",")
		if first {
			first = false
			for i, name := range cols {
				n := strings.TrimSpace(name)
				for _, w := range want {
					if n == w {
						idx[w] = i
					}
				}
			}
			// require at least the core columns
			for _, w := range []string{"Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG"} {
				if _, ok := idx[w]; !ok {
					return nil, fmt.Errorf("results csv missing %s", w)
				}
			}
			continue
		}
		get := func(k string) string {
			if i, ok := idx[k]; ok && i < len(cols) {
				return strings.TrimSpace(cols[i])
			}
			return ""
		}
		atoi := func(k string) int { v, _ := strconv.Atoi(get(k)); return v }

		hg, e1 := strconv.Atoi(get("FTHG"))
		ag, e2 := strconv.Atoi(get("FTAG"))
		if e1 != nil || e2 != nil {
			continue // unplayed
		}
		dateStr := get("Date")
		t, err := time.Parse("02/01/2006", dateStr)
		if err != nil {
			if t, err = time.Parse("02/01/06", dateStr); err != nil {
				continue
			}
		}
		date := t.Format("2006-01-02")
		home, away := get("HomeTeam"), get("AwayTeam")
		key := date + "|" + normTeam(home) + "|" + normTeam(away)
		out[key] = fullResult{
			home: home, away: away, hg: hg, ag: ag,
			hc: atoi("HC"), ac: atoi("AC"), hs: atoi("HS"), as: atoi("AS"),
			hf: atoi("HF"), af: atoi("AF"), ftr: get("FTR"),
		}
	}
	return out, nil
}

// lookupResultWithinADay tries the exact date then ±1 day (kickoffs can land a
// day off between the fixtures feed and co.uk).
func lookupResultWithinADay(m map[string]fullResult, date, nh, na string) (fullResult, bool) {
	if r, ok := m[date+"|"+nh+"|"+na]; ok {
		return r, true
	}
	if t, err := time.Parse("2006-01-02", date); err == nil {
		for _, off := range []int{-1, 1} {
			d := t.AddDate(0, 0, off).Format("2006-01-02")
			if r, ok := m[d+"|"+nh+"|"+na]; ok {
				return r, true
			}
		}
	}
	return fullResult{}, false
}

// GradeConfidentPicks grades every ungraded snapshot whose match has been played.
func GradeConfidentPicks(c echo.Context) error {
	rows, err := db.DB.Query(
		`SELECT id, market, league, home_team, away_team, team, opponent, match_date, prob_pct
		 FROM confident_snapshots
		 WHERE verdict IS NULL AND match_date < CURRENT_DATE`)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "query failed"})
	}
	type row struct {
		id                                            int
		market, league, home, away, team, opp, mdate  string
		prob                                          float64
	}
	var pending []row
	for rows.Next() {
		var r row
		var home, away, team, opp *string
		var md time.Time
		rows.Scan(&r.id, &r.market, &r.league, &home, &away, &team, &opp, &md, &r.prob)
		if home != nil {
			r.home = *home
		}
		if away != nil {
			r.away = *away
		}
		if team != nil {
			r.team = *team
		}
		if opp != nil {
			r.opp = *opp
		}
		r.mdate = md.Format("2006-01-02")
		pending = append(pending, r)
	}
	rows.Close()

	// group by league to fetch each league's results once. league here is the
	// display name; map back to a code via SupportedLeagues.
	nameToCode := map[string]string{}
	for _, lg := range SupportedLeagues {
		nameToCode[lg.Name] = lg.Code
	}
	resultsCache := map[string]map[string]fullResult{}

	graded, right, wrong, stillPending := 0, 0, 0, 0
	for _, r := range pending {
		code, ok := nameToCode[r.league]
		if !ok {
			stillPending++
			continue
		}
		res, ok := resultsCache[code]
		if !ok {
			res, err = fetchFullResultsCoUk(code)
			if err != nil {
				resultsCache[code] = nil
				stillPending++
				continue
			}
			resultsCache[code] = res
		}
		if res == nil {
			stillPending++
			continue
		}

		// resolve the fixture: for team markets, team/opp may be either side
		var fr fullResult
		var found bool
		if r.home != "" {
			fr, found = lookupResultWithinADay(res, r.mdate, normTeam(r.home), normTeam(r.away))
		} else {
			// team market: try team as home then team as away
			fr, found = lookupResultWithinADay(res, r.mdate, normTeam(r.team), normTeam(r.opp))
			if !found {
				fr, found = lookupResultWithinADay(res, r.mdate, normTeam(r.opp), normTeam(r.team))
			}
		}
		if !found {
			stillPending++
			continue
		}

		verdict, actual := gradePickMarket(r.market, r.team, fr)
		if verdict == "" {
			stillPending++
			continue
		}
		db.DB.Exec(`UPDATE confident_snapshots SET verdict=$1, actual=$2 WHERE id=$3`, verdict, actual, r.id)
		graded++
		if verdict == "right" {
			right++
		} else {
			wrong++
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"graded": graded, "right": right, "wrong": wrong, "pending": stillPending,
	})
}

// gradePickMarket applies the per-market rule and returns (verdict, actual).
func gradePickMarket(market, team string, fr fullResult) (string, string) {
	yes := func(cond bool, act string) (string, string) {
		if cond {
			return "right", act
		}
		return "wrong", act
	}
	// which side is `team`? (for team markets)
	teamIsHome := normTeam(team) == normTeam(fr.home)

	switch market {
	case "over_goals":
		return yes(fr.hg+fr.ag > 2, fmt.Sprintf("%d goals", fr.hg+fr.ag))
	case "btts":
		return yes(fr.hg > 0 && fr.ag > 0, fmt.Sprintf("%d-%d", fr.hg, fr.ag))
	case "over_corners":
		if fr.hc+fr.ac == 0 {
			return "", "" // corners not recorded
		}
		return yes(fr.hc+fr.ac > 8, fmt.Sprintf("%d corners", fr.hc+fr.ac))
	case "over_shots":
		if fr.hs+fr.as == 0 {
			return "", ""
		}
		return yes(fr.hs+fr.as > 26, fmt.Sprintf("%d shots", fr.hs+fr.as))
	case "over_fouls":
		if fr.hf+fr.af == 0 {
			return "", ""
		}
		return yes(fr.hf+fr.af > 24, fmt.Sprintf("%d fouls", fr.hf+fr.af))
	case "wins":
		won := (teamIsHome && fr.ftr == "H") || (!teamIsHome && fr.ftr == "A")
		return yes(won, fmt.Sprintf("%d-%d", fr.hg, fr.ag))
	case "team_shots":
		ts := fr.as
		if teamIsHome {
			ts = fr.hs
		}
		if fr.hs+fr.as == 0 {
			return "", ""
		}
		return yes(ts > 18, fmt.Sprintf("%d shots", ts))
	case "team_fouls":
		tf := fr.af
		if teamIsHome {
			tf = fr.hf
		}
		if fr.hf+fr.af == 0 {
			return "", ""
		}
		return yes(tf > 12, fmt.Sprintf("%d fouls", tf))
	}
	return "", ""
}

// GetPicksHistory returns the most recent snapshot that has graded picks, with
// each pick's verdict and a per-market hit-rate. Powers the "how did last week's
// confident picks do" view.
func GetPicksHistory(c echo.Context) error {
	// the latest snapshot_date that has at least one graded pick
	var snapDate *time.Time
	db.DB.QueryRow(
		`SELECT MAX(snapshot_date) FROM confident_snapshots WHERE verdict IS NOT NULL`).Scan(&snapDate)
	if snapDate == nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"snapshot_date": nil, "markets": map[string]interface{}{},
		})
	}
	sd := snapDate.Format("2006-01-02")

	rows, err := db.DB.Query(
		`SELECT market, league, home_team, away_team, team, opponent, prob_pct, verdict, actual
		 FROM confident_snapshots
		 WHERE snapshot_date = $1 AND verdict IS NOT NULL
		 ORDER BY market, prob_pct DESC`, sd)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "query failed"})
	}
	defer rows.Close()

	type pick struct {
		League  string  `json:"league"`
		Home    *string `json:"home,omitempty"`
		Away    *string `json:"away,omitempty"`
		Team    *string `json:"team,omitempty"`
		Opp     *string `json:"opponent,omitempty"`
		Prob    float64 `json:"prob_pct"`
		Verdict string  `json:"verdict"`
		Actual  *string `json:"actual,omitempty"`
	}
	markets := map[string][]pick{}
	hits := map[string][2]int{} // [right, total]
	for rows.Next() {
		var p pick
		var mk string
		rows.Scan(&mk, &p.League, &p.Home, &p.Away, &p.Team, &p.Opp, &p.Prob, &p.Verdict, &p.Actual)
		markets[mk] = append(markets[mk], p)
		h := hits[mk]
		h[1]++
		if p.Verdict == "right" {
			h[0]++
		}
		hits[mk] = h
	}

	rates := map[string]map[string]int{}
	for mk, h := range hits {
		rates[mk] = map[string]int{"right": h[0], "total": h[1]}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"snapshot_date": sd,
		"markets":       markets,
		"rates":         rates,
	})
}
