package handlers

import (
	"io"
	"net/http"

	"match-predictor/db"

	"github.com/labstack/echo/v4"
)

// GetLeaguePatterns proxies to Python's /league-patterns: a league's most-reliable
// markets this season, ranked by real hit-rate. Read-only; gated.
func GetLeaguePatterns(c echo.Context) error {
	var verified bool
	db.DB.QueryRow("SELECT verified FROM users WHERE id = $1", c.Get("user_id")).Scan(&verified)
	if !verified {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "unverified", "message": "Please verify your email to see league patterns.",
		})
	}
	pythonURL := c.Get("python_url").(string)
	resp, err := http.Get(pythonURL + "/league-patterns/" + c.Param("league"))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to reach ML service"})
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "ML service error"})
	}
	raw, _ := io.ReadAll(resp.Body)
	return c.Blob(http.StatusOK, "application/json", raw)
}
