package handlers

import (
	"bufio"
	"fmt"
	"net/http"
	"strings"
	"time"

	"match-predictor/models"
)

// football-data.co.uk Div codes for the leagues our other sources miss.
var footballDataCoUkDiv = map[string]string{
	"BEL": "B1", // Belgian Pro League
	"BL2": "D2", // 2. Bundesliga
	"PD2": "SP2", // Spanish Segunda
	"SB":  "I2",  // Serie B
	"FL2": "F2",  // Ligue 2
	"GSL": "G1",  // Greek Super League
}

// fetchFootballDataCoUk pulls upcoming fixtures from football-data.co.uk's
// weekly fixtures.csv — the same free provider used for training data.
func fetchFootballDataCoUk(leagueCode string) ([]models.Fixture, string, error) {
	div, ok := footballDataCoUkDiv[leagueCode]
	if !ok {
		return nil, "", fmt.Errorf("no football-data.co.uk div for %s", leagueCode)
	}

	fmt.Printf("DEBUG fdcouk: called for %s div=%s\n", leagueCode, div)
	req, _ := http.NewRequest("GET", "https://www.football-data.co.uk/fixtures.csv", nil)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("fixtures.csv returned %d", resp.StatusCode)
	}

	fixtures := []models.Fixture{}
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	first := true
	for scanner.Scan() {
		line := scanner.Text()
		if first { // header row
			first = false
			continue
		}
		line = strings.TrimRight(line, "\r")
		cols := strings.Split(line, ",")
		if len(cols) < 5 {
			continue
		}
		for i := range cols {
			cols[i] = strings.TrimSpace(cols[i])
		}
		if cols[0] != div {
			continue
		}
		// cols: Div, Date (dd/mm/yyyy), Time (HH:MM), HomeTeam, AwayTeam
		dateStr, timeStr, home, away := cols[1], cols[2], cols[3], cols[4]
		if timeStr == "" {
			timeStr = "15:00"
		}
		t, err := time.Parse("02/01/2006 15:04", dateStr+" "+timeStr)
		if err != nil {
			continue
		}
		var f models.Fixture
		f.UtcDate = t.UTC().Format("2006-01-02T15:04:05Z")
		f.HomeTeam.Name = home
		f.AwayTeam.Name = away
		f.ID = synthID(leagueCode, f.UtcDate, home, away)
		f.Competition.Code = leagueCode
		f.Competition.Name = leagueCode
		fixtures = append(fixtures, f)
	}
	if err := scanner.Err(); err != nil {
		return nil, "", err
	}
	fmt.Printf("DEBUG fdcouk: %s matched %d fixtures\n", leagueCode, len(fixtures))
	return fixtures, "football-data.co.uk", nil
}
