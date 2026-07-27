package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"match-predictor/db"
	"match-predictor/models"

	"github.com/labstack/echo/v4"
)

// Leagues we feature on the home page. Kept small on purpose —
// football-data.org's free tier allows only 10 requests/minute.
var featuredLeagues = []string{"PL", "PD", "SA", "BL1"}

// Marquee clubs per league. Matched loosely against the names
// football-data.org sends (e.g. "FC Bayern München" matches "Bayern").
var bigTeams = map[string][]string{
	"PL":  {"Arsenal", "Manchester City", "Liverpool", "Manchester United", "Chelsea", "Tottenham"},
	"PD":  {"Real Madrid", "Barcelona", "Atlético", "Sevilla"},
	"SA":  {"Juventus", "Inter", "Milan", "Napoli"},
	"BL1": {"Bayern", "Dortmund", "Leverkusen", "Leipzig"},
}

// FeaturedFixture is what the frontend renders in the home-page strip.
type FeaturedFixture struct {
	ID       int    `json:"id"`
	HomeTeam string `json:"home_team"`
	AwayTeam string `json:"away_team"`
	UtcDate  string `json:"utc_date"`
	League   string `json:"league"`
	LeagueNm string `json:"league_name"`
}

// isBigMatch reports whether either side is a marquee club for this league.
func isBigMatch(leagueCode, home, away string) bool {
	for _, t := range bigTeams[leagueCode] {
		if strings.Contains(home, t) || strings.Contains(away, t) {
			return true
		}
	}
	return false
}

// GetFeatured returns upcoming fixtures involving marquee clubs across a
// handful of top leagues. Cached hard in Redis so every visitor shares one
// set of upstream calls rather than each browser making its own.
func GetFeatured(c echo.Context) error {
	const cacheKey = "featured:v1"

	if cached, err := db.RedisClient.Get(db.Ctx, cacheKey).Result(); err == nil {
		var out []FeaturedFixture
		if json.Unmarshal([]byte(cached), &out) == nil {
			return c.JSON(http.StatusOK, map[string]interface{}{
				"fixtures": out,
				"cached":   true,
			})
		}
	}

	apiKey := c.Get("football_api_key").(string)
	client := &http.Client{Timeout: 10 * time.Second}

	featured := []FeaturedFixture{}

	for _, code := range featuredLeagues {
		url := fmt.Sprintf(
			"https://api.football-data.org/v4/competitions/%s/matches?status=SCHEDULED",
			code,
		)

		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			continue
		}
		req.Header.Set("X-Auth-Token", apiKey)

		resp, err := client.Do(req)
		if err != nil {
			// One league failing shouldn't empty the whole strip
			continue
		}

		var fr models.FixturesResponse
		decodeErr := json.NewDecoder(resp.Body).Decode(&fr)
		resp.Body.Close()
		if decodeErr != nil || resp.StatusCode != http.StatusOK {
			c.Logger().Warnf("featured: %s failed (status %d)", code, resp.StatusCode)
			continue
		}

		// Take the earliest few big-team fixtures from this league
		perLeague := 0
		for _, m := range fr.Matches {
			if perLeague >= 3 {
				break
			}
			if !isBigMatch(code, m.HomeTeam.Name, m.AwayTeam.Name) {
				continue
			}
			featured = append(featured, FeaturedFixture{
				ID:       m.ID,
				HomeTeam: m.HomeTeam.Name,
				AwayTeam: m.AwayTeam.Name,
				UtcDate:  m.UtcDate,
				League:   code,
				LeagueNm: m.Competition.Name,
			})
			perLeague++
		}
	}

	// Only cache a real result — caching an empty list would hide upstream failures
	if len(featured) > 0 {
		if b, err := json.Marshal(featured); err == nil {
			db.RedisClient.Set(db.Ctx, cacheKey, b, 30*time.Minute)
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"fixtures": featured,
		"cached":   false,
	})
}
