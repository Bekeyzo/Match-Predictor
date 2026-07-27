package handlers

import (
	"encoding/json"
	"fmt"
	"hash/fnv"
	"net/http"
	"time"

	"match-predictor/models"
)

// Leagues football-data.org's free tier doesn't cover, mapped to
// openfootball/football.json file codes. Free, public domain, no API key.
var openfootballCodes = map[string]string{
	"PD2": "es.2", // Segunda División
	"BL2": "de.2", // 2. Bundesliga
	"SB":  "it.2", // Serie B
	"FL2": "fr.2", // Ligue 2
	"BEL": "be.1", // Belgian First Division A
	"GSL": "gr.1", // Super League Greece
}

type ofMatch struct {
	Round string `json:"round"`
	Date  string `json:"date"`
	Time  string `json:"time"`
	Team1 string `json:"team1"`
	Team2 string `json:"team2"`
}

type ofSeason struct {
	Name    string    `json:"name"`
	Matches []ofMatch `json:"matches"`
}

// seasonsToTry returns season directory names, newest first — the upcoming
// season may not be published yet, so we fall back to the current one.
func seasonsToTry() []string {
	y := time.Now().Year()
	return []string{
		fmt.Sprintf("%d-%02d", y, (y+1)%100),
		fmt.Sprintf("%d-%02d", y-1, y%100),
	}
}

// openfootball has no match IDs, so derive a stable one from the fixture itself
func synthID(parts ...string) int {
	h := fnv.New32a()
	for _, p := range parts {
		h.Write([]byte(p))
	}
	return int(h.Sum32() % 1000000000)
}

func toFixtures(s ofSeason, leagueCode string) []models.Fixture {
	today := time.Now().Format("2006-01-02")
	out := []models.Fixture{}

	for _, m := range s.Matches {
		if m.Date < today { // ISO dates compare correctly as strings
			continue
		}
		kick := m.Time
		if kick == "" {
			kick = "15:00"
		}

		var f models.Fixture
		f.ID = synthID(leagueCode, m.Date, m.Team1, m.Team2)
		f.Status = "SCHEDULED"
		f.UtcDate = fmt.Sprintf("%sT%s:00Z", m.Date, kick)
		f.HomeTeam.Name = m.Team1
		f.AwayTeam.Name = m.Team2
		f.Competition.Code = leagueCode
		f.Competition.Name = s.Name

		out = append(out, f)
		if len(out) >= 20 {
			break
		}
	}
	return out
}

// fetchOpenfootball gets upcoming fixtures for a league not covered by
// football-data.org's free tier.
func fetchOpenfootball(leagueCode string) ([]models.Fixture, string, error) {
	code, ok := openfootballCodes[leagueCode]
	if !ok {
		return nil, "", fmt.Errorf("no openfootball mapping for %s", leagueCode)
	}

	client := &http.Client{Timeout: 10 * time.Second}

	for _, season := range seasonsToTry() {
		url := fmt.Sprintf(
			"https://raw.githubusercontent.com/openfootball/football.json/master/%s/%s.json",
			season, code,
		)

		resp, err := client.Get(url)
		if err != nil {
			continue
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			continue
		}

		var s ofSeason
		decErr := json.NewDecoder(resp.Body).Decode(&s)
		resp.Body.Close()
		if decErr != nil {
			continue
		}

		return toFixtures(s, leagueCode), s.Name, nil
	}

	return nil, "", fmt.Errorf("no openfootball data for %s", leagueCode)
}
