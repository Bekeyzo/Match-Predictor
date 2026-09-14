package handlers

import (
	"io"
	"net/http"

	"match-predictor/db"

	"github.com/labstack/echo/v4"
)

// GetTrends proxies to the Python /trends endpoint: the leading league per stat
// (shots/corners/fouls/cards) and that league's top 5 teams. Read-only; gated.
func GetTrends(c echo.Context) error {
	var verified bool
	db.DB.QueryRow("SELECT verified FROM users WHERE id = $1", c.Get("user_id")).Scan(&verified)
	if !verified {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error":   "unverified",
			"message": "Please verify your email to see league trends.",
		})
	}

	pythonURL := c.Get("python_url").(string)
	resp, err := http.Get(pythonURL + "/trends")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to reach ML service"})
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "ML service error"})
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to read trends"})
	}
	return c.Blob(http.StatusOK, "application/json", raw)
}
