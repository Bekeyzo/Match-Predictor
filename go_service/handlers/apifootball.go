package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"match-predictor/models"
)

// API-Football uses numeric league IDs. Map our codes to theirs.
// Only the leagues openfootball can't reliably serve need to be here.
var apiFootballLeagueIDs = map[string]int{
	"BEL": 144, // Belgian Pro League
	"BL2": 79,  // 2. Bundesliga
	"PD2": 141, // Spanish Segunda
	"SB":  136, // Serie B
	"FL2": 62,  // Ligue 2
	"GSL": 197, // Greek Super League
}

// Shape of API-Football's /fixtures response (only the fields we use).
type afResponse struct {
	Response []struct {
		Fixture struct {
			Date   string `json:"date"` // ISO8601, e.g. 2026-08-16T18:00:00+00:00
			Status struct {
				Short string `json:"short"` // NS, 1H, HT, FT, etc.
			} `json:"status"`
		} `json:"fixture"`
		Teams struct {
			Home struct {
				Name string `json:"name"`
			} `json:"home"`
			Away struct {
				Name string `json:"name"`
			} `json:"away"`
		} `json:"teams"`
	} `json:"response"`
}

// fetchApiFootball pulls fixtures for a league from API-Football (fallback #3).
func fetchApiFootball(leagueCode string) ([]models.Fixture, string, error) {
	leagueID, ok := apiFootballLeagueIDs[leagueCode]
	if !ok {
		return nil, "", fmt.Errorf("no api-football mapping for %s", leagueCode)
	}
	apiKey := os.Getenv("APIFOOTBALL_KEY")
	if apiKey == "" {
		return nil, "", fmt.Errorf("APIFOOTBALL_KEY not set")
	}

	today := time.Now().Format("2006-01-02")
	weekOut := time.Now().AddDate(0, 0, 7).Format("2006-01-02")
	season := time.Now().Year()
	// Season rolls in summer; before August, the season year is the previous one.
	if int(time.Now().Month()) < 8 {
		season = season - 1
	}

	url := fmt.Sprintf(
		"https://v3.football.api-sports.io/fixtures?league=%d&season=%d&from=%s&to=%s",
		leagueID, season, today, weekOut,
	)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("x-apisports-key", apiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("api-football returned %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}

	var af afResponse
	if err := json.Unmarshal(body, &af); err != nil {
		return nil, "", err
	}

	fixtures := make([]models.Fixture, 0, len(af.Response))
	for _, r := range af.Response {
		var f models.Fixture
		// Normalise the date to the same RFC3339 Z form the rest of the app uses.
		if t, err := time.Parse(time.RFC3339, r.Fixture.Date); err == nil {
			f.UtcDate = t.UTC().Format("2006-01-02T15:04:05Z")
		} else {
			f.UtcDate = r.Fixture.Date
		}
		f.HomeTeam.Name = r.Teams.Home.Name
		f.AwayTeam.Name = r.Teams.Away.Name
		f.Status = r.Fixture.Status.Short
		f.ID = synthID(leagueCode, f.UtcDate, r.Teams.Home.Name, r.Teams.Away.Name)
		f.Competition.Code = leagueCode
		f.Competition.Name = leagueCode
		fixtures = append(fixtures, f)
	}

	return fixtures, "api-football", nil
}
