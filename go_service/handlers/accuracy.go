package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"match-predictor/db"

	"github.com/labstack/echo/v4"
)

// GetAccuracy proxies the ML service's backtest scores, cached hard —
// they only change when models retrain (Mon & Thu).
func GetAccuracy(c echo.Context) error {
	const cacheKey = "accuracy:v1"

	if cached, err := db.RedisClient.Get(db.Ctx, cacheKey).Result(); err == nil {
		var payload map[string]interface{}
		if json.Unmarshal([]byte(cached), &payload) == nil {
			return c.JSON(http.StatusOK, payload)
		}
	}

	pythonURL := c.Get("python_url").(string)
	client := &http.Client{Timeout: 10 * time.Second}

	resp, err := client.Get(pythonURL + "/accuracy")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "ML service unreachable"})
	}
	defer resp.Body.Close()

	var payload map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Bad response from ML service"})
	}

	if b, err := json.Marshal(payload); err == nil {
		db.RedisClient.Set(db.Ctx, cacheKey, b, 6*time.Hour)
	}

	return c.JSON(http.StatusOK, payload)
}
