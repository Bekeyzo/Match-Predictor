package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"match-predictor/db"
	"match-predictor/models"

	"github.com/labstack/echo/v4"
)

// GetH2H proxies to the Python /h2h endpoint and returns the last N
// head-to-head meetings between the two teams. Read-only; no caching, no DB
// writes — it's reference context loaded on demand when a user opens H2H.
func GetH2H(c echo.Context) error {
	var req models.PredictionRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	// Same gate as predictions: only verified accounts.
	var verified bool
	db.DB.QueryRow("SELECT verified FROM users WHERE id = $1", c.Get("user_id")).Scan(&verified)
	if !verified {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error":   "unverified",
			"message": "Please verify your email to see head-to-head data.",
		})
	}

	pythonURL := c.Get("python_url").(string)

	// Python /h2h wants only these three fields (no match_date).
	body, _ := json.Marshal(map[string]string{
		"home_team":   req.HomeTeam,
		"away_team":   req.AwayTeam,
		"league_code": req.LeagueCode,
	})

	resp, err := http.Post(pythonURL+"/h2h", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to reach ML service"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "ML service error"})
	}

	// Pass the raw JSON straight through (no typed struct needed).
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to read H2H"})
	}
	return c.Blob(http.StatusOK, "application/json", raw)
}
