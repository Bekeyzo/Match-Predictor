package handlers

import (
	"io"
	"net/http"

	"match-predictor/db"

	"github.com/labstack/echo/v4"
)

// GetAnalysis proxies to the Python /analysis/<league> endpoint and returns
// the current-season per-team shots / shots-on-target / corners per game.
// Read-only; no caching, no DB writes. Gated like predictions.
func GetAnalysis(c echo.Context) error {
	league := c.Param("league")
	if league == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Missing league"})
	}

	// Same gate as predictions: only verified accounts.
	var verified bool
	db.DB.QueryRow("SELECT verified FROM users WHERE id = $1", c.Get("user_id")).Scan(&verified)
	if !verified {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error":   "unverified",
			"message": "Please verify your email to see analysis.",
		})
	}

	pythonURL := c.Get("python_url").(string)

	resp, err := http.Get(pythonURL + "/analysis/" + league)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to reach ML service"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "ML service error"})
	}

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to read analysis"})
	}
	return c.Blob(http.StatusOK, "application/json", raw)
}
