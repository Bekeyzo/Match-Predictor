package handlers

import (
	"net/http"
	"strings"

	"match-predictor/db"

	"github.com/labstack/echo/v4"
)

// GetMe returns the logged-in user's profile.
func GetMe(c echo.Context) error {
	userID := c.Get("user_id")

	var username, email string
	var createdAt string
	err := db.DB.QueryRow(
		"SELECT username, COALESCE(email, ''), created_at FROM users WHERE id = $1",
		userID,
	).Scan(&username, &email, &createdAt)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"username":   username,
		"email":      email,
		"created_at": createdAt,
	})
}

type updateNameInput struct {
	Name string `json:"name"`
}

// UpdateName changes the logged-in user's display name.
func UpdateName(c echo.Context) error {
	userID := c.Get("user_id")

	var in updateNameInput
	if err := c.Bind(&in); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}
	name := strings.TrimSpace(in.Name)
	if len(name) < 1 || len(name) > 32 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Name must be 1-32 characters"})
	}

	_, err := db.DB.Exec("UPDATE users SET username = $1 WHERE id = $2", name, userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Could not update name"})
	}

	return c.JSON(http.StatusOK, map[string]string{"username": name})
}
