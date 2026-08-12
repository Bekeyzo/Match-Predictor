package handlers

import (
	"encoding/json"
	"net/http"

	"match-predictor/db"

	"github.com/labstack/echo/v4"
)

// GetPredictionDates returns the past dates (most recent first) that have
// stored predictions for a league — this drives the ◀/▶ matchday stepper.
func GetPredictionDates(c echo.Context) error {
	league := c.QueryParam("league")
	if league == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "league required"})
	}

	rows, err := db.DB.Query(
		`SELECT DISTINCT match_date FROM predictions
		 WHERE league_code = $1 AND match_date < CURRENT_DATE
		 ORDER BY match_date DESC`,
		league,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "query failed"})
	}
	defer rows.Close()

	dates := []string{}
	for rows.Next() {
		var d string
		if rows.Scan(&d) == nil {
			// d comes back as a full timestamp; trim to YYYY-MM-DD
			if len(d) >= 10 {
				d = d[:10]
			}
			dates = append(dates, d)
		}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"league": league, "dates": dates})
}

// GetPredictionHistory returns the stored predictions for a league on a given past date.
func GetPredictionHistory(c echo.Context) error {
	league := c.QueryParam("league")
	date := c.QueryParam("date")
	if league == "" || date == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "league and date required"})
	}

	rows, err := db.DB.Query(
		`SELECT home_team, away_team, prediction, predicted_at FROM predictions
		 WHERE league_code = $1 AND match_date = $2
		 ORDER BY home_team`,
		league, date,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "query failed"})
	}
	defer rows.Close()

	type histItem struct {
		HomeTeam    string          `json:"home_team"`
		AwayTeam    string          `json:"away_team"`
		Prediction  json.RawMessage `json:"prediction"`
		PredictedAt string          `json:"predicted_at"`
	}
	items := []histItem{}
	for rows.Next() {
		var it histItem
		var raw []byte
		if rows.Scan(&it.HomeTeam, &it.AwayTeam, &raw, &it.PredictedAt) == nil {
			it.Prediction = json.RawMessage(raw)
			items = append(items, it)
		}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"league": league, "date": date, "predictions": items,
	})
}
