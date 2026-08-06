package handlers

import (
	"net/http"
	"time"
	"os"
	"encoding/hex"
	"crypto/rand"
	"strings"

	"match-predictor/db"
	"match-predictor/models"
	"match-predictor/utils"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

type registerInput struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Register(c echo.Context) error {
	var user registerInput
	if err := c.Bind(&user); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	if len(user.Username) < 3 || len(user.Username) > 32 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Username must be 3-32 characters"})
	}
	if len(user.Password) < 8 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Password must be at least 8 characters"})
	}
	if !strings.Contains(user.Email, "@") || !strings.Contains(user.Email, ".") || len(user.Email) < 5 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Please enter a valid email"})
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Error hashing password"})
	}

	var created models.User
	created.Username = user.Username
	err = db.DB.QueryRow(
		"INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, created_at",
		user.Username, user.Email, string(hashed),
	).Scan(&created.ID, &created.CreatedAt)

	if err != nil {
		return c.JSON(http.StatusConflict, map[string]string{"error": "Username already exists"})
	}

	return c.JSON(http.StatusCreated, created)
}

type loginInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func Login(c echo.Context) error {
	var input loginInput
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

type forgotInput struct {
	Email string `json:"email"`
}

// ForgotPassword generates a reset token and emails a link.
// Always returns the same message whether or not the email exists,
// so it can't be used to discover which emails have accounts.
func ForgotPassword(c echo.Context) error {
	var in forgotInput
	if err := c.Bind(&in); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	const okMsg = "If that email has an account, a reset link is on its way."

	var userID int
	err := db.DB.QueryRow("SELECT id FROM users WHERE email = $1", in.Email).Scan(&userID)
	if err != nil {
		// No such email — return success anyway (don't leak which emails exist)
		return c.JSON(http.StatusOK, map[string]string{"message": okMsg})
	}

	// random token
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Could not generate token"})
	}
	token := hex.EncodeToString(b)

	_, err = db.DB.Exec(
		"INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)",
		userID, token, time.Now().Add(1*time.Hour),
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Could not create reset"})
	}

	base := os.Getenv("FRONTEND_URL")
	if base == "" {
		base = "https://tehuti.net"
	}
	link := base + "/reset?token=" + token

	if err := utils.SendResetEmail(in.Email, link); err != nil {
		c.Logger().Errorf("reset email failed: %v", err)
		// still return ok to the user; don't expose mail internals
	}

	return c.JSON(http.StatusOK, map[string]string{"message": okMsg})
}

type resetInput struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

// ResetPassword verifies the token and sets a new password.
func ResetPassword(c echo.Context) error {
	var in resetInput
	if err := c.Bind(&in); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}
	if len(in.Password) < 8 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Password must be at least 8 characters"})
	}

	var userID int
	var expiresAt time.Time
	var used bool
	err := db.DB.QueryRow(
		"SELECT user_id, expires_at, used FROM password_resets WHERE token = $1",
		in.Token,
	).Scan(&userID, &expiresAt, &used)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid or expired reset link"})
	}
	if used || time.Now().After(expiresAt) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "This reset link has expired or been used"})
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Error hashing password"})
	}

	if _, err := db.DB.Exec("UPDATE users SET password = $1 WHERE id = $2", string(hashed), userID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Could not update password"})
	}
	db.DB.Exec("UPDATE password_resets SET used = TRUE WHERE token = $1", in.Token)

	return c.JSON(http.StatusOK, map[string]string{"message": "Password updated. You can sign in now."})
}
