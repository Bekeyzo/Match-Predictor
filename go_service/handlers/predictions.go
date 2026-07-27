package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"match-predictor/db"
	"match-predictor/models"
	"match-predictor/utils"

	"github.com/labstack/echo/v4"
)

func GetPrediction(c echo.Context) error {
	var req models.PredictionRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	// Build a unique cache key for this specific fixture
	// So Arsenal vs Chelsea on 2026-07-16 in PL gets its own cache entry
	cacheKey := fmt.Sprintf("prediction:%s:%s:%s:%s",
		req.LeagueCode, req.MatchDate, req.HomeTeam, req.AwayTeam,
	)

	// Step 1 — Check Redis cache first
	// If this exact fixture was already predicted today, return it instantly
	cached, err := db.RedisClient.Get(db.Ctx, cacheKey).Result()
	if err == nil {
		var result models.PredictionResult
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			// Add a flag so frontend knows this came from cache
			return c.JSON(http.StatusOK, map[string]interface{}{
				"prediction": result,
				"cached":     true,
			})
		}
	}

	// Step 2 — Cache miss, call Python ML service
	pythonURL := c.Get("python_url").(string)

	// Convert request to JSON for Python service
	body, err := json.Marshal(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to build request"})
	}

	// Call Python FastAPI predict endpoint
	resp, err := http.Post(
		pythonURL+"/predict",
		"application/json",
		bytes.NewBuffer(body),
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to reach ML service"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "ML service error"})
	}

	// Decode the prediction result
	var result models.PredictionResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to decode prediction"})
	}

	// Step 3 — Save to Redis for 6 hours
	// Predictions for the same fixture don't change much within a day
	// so we cache them to avoid hitting Python service repeatedly
	resultJSON, _ := json.Marshal(result)
	db.RedisClient.Set(db.Ctx, cacheKey, resultJSON, 6*time.Hour)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"prediction": result,
		"cached":     false,
	})
}

// TriggerRetrain publishes a retrain message to RabbitMQ
// Called after a matchday ends so the model gets updated with new results
func TriggerRetrain(c echo.Context) error {
	leagueCode := c.Param("league")

	// Publish message to RabbitMQ retrain queue
	err := utils.PublishRetrainMessage(leagueCode)
	if err != nil {
		// If RabbitMQ is down, fall back to calling Python directly
		pythonURL := c.Get("python_url").(string)
		body, _ := json.Marshal(map[string]string{"league_code": leagueCode})
		http.Post(pythonURL+"/retrain", "application/json", bytes.NewBuffer(body))
	}

	return c.JSON(http.StatusOK, map[string]string{
		"status":      "retrain triggered",
		"league_code": leagueCode,
	})
}
