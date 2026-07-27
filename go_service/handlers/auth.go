package handlers

import (
	"net/http"

	"match-predictor/db"
	"match-predictor/models"
	"match-predictor/utils"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

func Register(c echo.Context) error {
	var user models.User
	if err := c.Bind(&user); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	if len(user.Username) < 3 || len(user.Username) > 32 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Username must be 3-32 characters"})
	}
	if len(user.Password) < 8 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Password must be at least 8 characters"})
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Error hashing password"})
	}

	err = db.DB.QueryRow(
		"INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, created_at",
		user.Username, string(hashed),
	).Scan(&user.ID, &user.CreatedAt)

	if err != nil {
		return c.JSON(http.StatusConflict, map[string]string{"error": "Username already exists"})
	}

	return c.JSON(http.StatusCreated, user)
}

func Login(c echo.Context) error {
	var input models.User
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	var user models.User
	err := db.DB.QueryRow(
		"SELECT id, username, password FROM users WHERE username = $1",
		input.Username,
	).Scan(&user.ID, &user.Username, &user.Password)

	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid credentials"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid credentials"})
	}

	token, err := utils.GenerateToken(user.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Error generating token"})
	}

	return c.JSON(http.StatusOK, map[string]string{"token": token})
}
