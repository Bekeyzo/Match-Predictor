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
	"PL":   "E0",  // Premier League
	"ELC":  "E1",  // Championship
	"PD":   "SP1", // La Liga
	"PD2":  "SP2", // Spanish Segunda
	"BL1":  "D1",  // Bundesliga
	"BL2":  "D2",  // 2. Bundesliga
	"SA":   "I1",  // Serie A
	"SB":   "I2",  // Serie B
	"FL1":  "F1",  // Ligue 1
	"FL2":  "F2",  // Ligue 2
	"DED":  "N1",  // Eredivisie
	"PPL":  "P1",  // Primeira Liga
	"BEL":  "B1",  // Belgian Pro League
	"GSL":  "G1",  // Greek Super League
	"TUR":  "T1",  // Turkish Super Lig
}

// fetchFootballDataCoUk pulls upcoming fixtures from football-data.co.uk's
// weekly fixtures.csv — the same free provider used for training data.
func fetchFootballDataCoUk(leagueCode string) ([]models.Fixture, string, error) {
	div, ok := footballDataCoUkDiv[leagueCode]
	if !ok {
		return nil, "", fmt.Errorf("no football-data.co.uk div for %s", leagueCode)
	}

	req, _ := http.NewRequest("GET", "https://football-data.co.uk/fixtures.csv", nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; TehutiBot/1.0)")
	client := &http.Client{Timeout: 15 * time.Second}
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
	return fixtures, "football-data.co.uk", nil
}
