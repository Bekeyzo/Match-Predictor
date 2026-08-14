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
	if err != nil {
		c.Logger().Warnf("fixtures: %s primary failed (%v) — trying openfootball", leagueCode, err)
		fallback, _, ofErr := fetchOpenfootball(leagueCode)
		if ofErr != nil {
			c.Logger().Warnf("fixtures: %s fallback failed too (%v)", leagueCode, ofErr)
			return c.JSON(http.StatusOK, map[string]interface{}{
				"date": today, "league": leagueCode,
				"fixtures": []models.Fixture{}, "source": "none",
			})
		}
		matches = fallback
		source = "openfootball"
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

	// Only cache a real result — never cache an empty list
	if len(matches) > 0 {
		if b, err := json.Marshal(payload); err == nil {
			db.RedisClient.Set(db.Ctx, cacheKey, b, 15*time.Minute)
		}
	}

	return c.JSON(http.StatusOK, payload)
}
