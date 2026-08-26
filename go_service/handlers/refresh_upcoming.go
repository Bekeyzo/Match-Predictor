package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"match-predictor/db"
	"match-predictor/models"

	"github.com/labstack/echo/v4"
)

// RefreshUpcoming sweeps predictions for fixtures that have NOT yet kicked off
// (match_date >= today) and re-checks each against the Python model. Because the
// match hasn't been played, re-predicting is honest (no result to leak).
//
// DRY-RUN: this version only REPORTS what it would change; it writes nothing.
// Flip dryRun to false (a later change) to actually overwrite/delete.
func RefreshUpcoming(c echo.Context) error {
	const dryRun = true

	pythonURL := c.Get("python_url").(string)

	rows, err := db.DB.Query(
		`SELECT id, league_code, match_date, home_team, away_team, prediction
		 FROM predictions
		 WHERE match_date >= CURRENT_DATE
		 ORDER BY match_date`,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "query failed"})
	}
	defer rows.Close()

	type change struct {
		ID        int     `json:"id"`
		Fixture   string  `json:"fixture"`
		Date      string  `json:"date"`
		Action    string  `json:"action"` // "overwrite" | "delete" | "ok"
		StoredXGH float64 `json:"stored_xgh"`
		FreshXGH  float64 `json:"fresh_xgh"`
	}
	var changes []change
	scanned := 0

	for rows.Next() {
		var id int
		var lg, home, away string
		var mdate time.Time
		var raw []byte
		if rows.Scan(&id, &lg, &mdate, &home, &away, &raw) != nil {
			continue
		}
		scanned++

		var stored models.PredictionResult
		_ = json.Unmarshal(raw, &stored)

		// Ask Python for a fresh prediction
		reqBody, _ := json.Marshal(map[string]string{
			"home_team":   home,
			"away_team":   away,
			"league_code": lg,
			"match_date":  mdate.Format("2006-01-02"),
		})
		resp, err := http.Post(pythonURL+"/predict", "application/json", bytes.NewBuffer(reqBody))
		if err != nil {
			continue
		}
		var fresh models.PredictionResult
		_ = json.NewDecoder(resp.Body).Decode(&fresh)
		resp.Body.Close()

		fixture := home + " v " + away
		dateStr := mdate.Format("2006-01-02")

		if fresh.InsufficientData != nil && *fresh.InsufficientData {
			changes = append(changes, change{id, fixture, dateStr, "delete", stored.ExpectedHomeGoals, 0})
			continue
		}
		// material divergence in expected home goals => fossil, would overwrite
		diff := stored.ExpectedHomeGoals - fresh.ExpectedHomeGoals
		if diff < 0 {
			diff = -diff
		}
		if diff > 0.8 {
			changes = append(changes, change{id, fixture, dateStr, "overwrite", stored.ExpectedHomeGoals, fresh.ExpectedHomeGoals})
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"dry_run":       dryRun,
		"scanned":       scanned,
		"would_change":  len(changes),
		"changes":       changes,
		"note":          fmt.Sprintf("DRY RUN — nothing written. %d upcoming predictions scanned.", scanned),
	})
}
