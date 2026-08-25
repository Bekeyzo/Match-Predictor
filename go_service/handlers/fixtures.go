package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"match-predictor/db"
	"match-predictor/models"

	"github.com/labstack/echo/v4"
)

// 8 from football-data.org's free tier + 6 served by openfootball.
// Dropped: Liga Portugal 2 and both Scottish tiers — no free source.
var SupportedLeagues = []models.League{
	{Code: "PL", Name: "Premier League", Flag: "ENG"},
	{Code: "ELC", Name: "Championship", Flag: "ENG"},
	{Code: "PD", Name: "La Liga", Flag: "ESP"},
	{Code: "PD2", Name: "Segunda División", Flag: "ESP"},
	{Code: "BL1", Name: "Bundesliga", Flag: "GER"},
	{Code: "BL2", Name: "2. Bundesliga", Flag: "GER"},
	{Code: "SA", Name: "Serie A", Flag: "ITA"},
	{Code: "SB", Name: "Serie B", Flag: "ITA"},
	{Code: "FL1", Name: "Ligue 1", Flag: "FRA"},
	{Code: "FL2", Name: "Ligue 2", Flag: "FRA"},
	{Code: "DED", Name: "Eredivisie", Flag: "NED"},
	{Code: "PPL", Name: "Primeira Liga", Flag: "POR"},
	{Code: "BEL", Name: "Belgian First Division A", Flag: "BEL"},
	{Code: "GSL", Name: "Super League Greece", Flag: "GRE"},
}

func GetLeagues(c echo.Context) error {
	return c.JSON(http.StatusOK, SupportedLeagues)
}

// fetchFootballDataOrg gets fixtures from the primary source.
func fetchFootballDataOrg(leagueCode, apiKey string) ([]models.Fixture, error) {
	today := time.Now().Format("2006-01-02")
	weekOut := time.Now().AddDate(0, 0, 7).Format("2006-01-02")
	url := fmt.Sprintf(
		"https://api.football-data.org/v4/competitions/%s/matches?dateFrom=%s&dateTo=%s",
		leagueCode, today, weekOut,
	)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Auth-Token", apiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("football-data.org returned %d", resp.StatusCode)
	}

	var fr models.FixturesResponse
	if err := json.NewDecoder(resp.Body).Decode(&fr); err != nil {
		return nil, err
	}

	matches := fr.Matches
	if len(matches) > 20 {
		matches = matches[:20]
	}
	return matches, nil
}

// GetFixtures tries football-data.org first, then falls back to openfootball
// for leagues outside the free tier.
func GetFixtures(c echo.Context) error {
	leagueCode := c.Param("league")
	apiKey := c.Get("football_api_key").(string)

	cacheKey := "fixtures:" + leagueCode
	if cached, err := db.RedisClient.Get(db.Ctx, cacheKey).Result(); err == nil {
		var payload map[string]interface{}
		if json.Unmarshal([]byte(cached), &payload) == nil {
			return c.JSON(http.StatusOK, payload)
		}
	}

	today := time.Now().Format("2006-01-02")
	source := "football-data.org"

	matches, err := fetchFootballDataOrg(leagueCode, apiKey)
	if err != nil || len(matches) == 0 {
		if err != nil {
			c.Logger().Warnf("fixtures: %s primary failed (%v) — trying openfootball", leagueCode, err)
		}
		fallback, _, ofErr := fetchOpenfootball(leagueCode)
		if ofErr == nil && len(fallback) > 0 {
			matches = fallback
			source = "openfootball"
		} else {
			// openfootball errored OR returned empty — try API-Football as the last resort
			afFixtures, afSource, afErr := fetchFootballDataCoUk(leagueCode)
			if afErr == nil && len(afFixtures) > 0 {
				matches = afFixtures
				source = afSource
			} else {
				c.Logger().Warnf("fixtures: %s all sources empty (of=%v af=%v)", leagueCode, ofErr, afErr)
				return c.JSON(http.StatusOK, map[string]interface{}{
					"date": today, "league": leagueCode,
					"fixtures": []models.Fixture{}, "source": "none",
				})
			}
		}
	}

	// Keep only fixtures within the next 7 days (avoid showing a second matchday out)
	cutoff := time.Now().AddDate(0, 0, 7)
	startOfToday := time.Now().Truncate(24 * time.Hour)
	kept := make([]models.Fixture, 0, len(matches))
	for _, m := range matches {
		t, err := time.Parse(time.RFC3339, m.UtcDate)
		if err != nil {
			kept = append(kept, m) // keep if we can't parse, rather than silently drop
			continue
		}
		if !t.Before(startOfToday) && t.Before(cutoff) {
			kept = append(kept, m)
		}
	}
	matches = kept

	payload := map[string]interface{}{
		"date":     today,
		"league":   leagueCode,
		"fixtures": matches,
		"source":   source,
	}

	if len(matches) > 0 {
		// Real result — cache it for the usual window.
		if b, err := json.Marshal(payload); err == nil {
			db.RedisClient.Set(db.Ctx, cacheKey, b, 15*time.Minute)
		}
	} else {
		// Nothing in the next 7 days — try to tell the user the exact next date.
		if nd := nextFixtureDate(leagueCode, apiKey); nd != "" {
			payload["next_fixture_date"] = nd
		}
		// Cache the empty(+maybe date) result briefly so the extra lookup
		// doesn't run on every request for a between-matchdays league.
		if b, err := json.Marshal(payload); err == nil {
			db.RedisClient.Set(db.Ctx, cacheKey, b, 30*time.Minute)
		}
	}

	return c.JSON(http.StatusOK, payload)
}

// nextFixtureDate returns the date (YYYY-MM-DD) of the earliest upcoming
// SCHEDULED fixture for a league, looking beyond the 7-day window. Used to
// tell users exactly when a between-matchdays league next plays. Returns ""
// if unavailable (e.g. leagues football-data.org doesn't cover).
func nextFixtureDate(leagueCode, apiKey string) string {
	url := fmt.Sprintf("https://api.football-data.org/v4/competitions/%s/matches?status=SCHEDULED", leagueCode)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("X-Auth-Token", apiKey)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return ""
	}
	var body struct {
		Matches []struct {
			UtcDate string `json:"utcDate"`
		} `json:"matches"`
	}
	if json.NewDecoder(resp.Body).Decode(&body) != nil {
		return ""
	}
	earliest := ""
	for _, m := range body.Matches {
		if len(m.UtcDate) < 10 {
			continue
		}
		d := m.UtcDate[:10]
		if earliest == "" || d < earliest {
			earliest = d
		}
	}
	return earliest
}
