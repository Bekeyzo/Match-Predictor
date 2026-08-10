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
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Register(c echo.Context) error {
	var user registerInput
	if err := c.Bind(&user); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	if len(user.Password) < 8 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Password must be at least 8 characters"})
	}
	if !strings.Contains(user.Email, "@") || !strings.Contains(user.Email, ".") || len(user.Email) < 5 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Please enter a valid email"})
	}

	// Display name derived from the email local-part (not unique — email is the identity)
	displayName := strings.Split(user.Email, "@")[0]

	hashed, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Error hashing password"})
	}

	var created models.User
	created.Username = displayName
	err = db.DB.QueryRow(
		"INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, created_at",
		displayName, user.Email, string(hashed),
	).Scan(&created.ID, &created.CreatedAt)

	if err != nil {
		return c.JSON(http.StatusConflict, map[string]string{"error": "An account with that email already exists"})
	}

	// Generate a verification token and email a confirm link (non-fatal if it fails)
	vb := make([]byte, 32)
	if _, e := rand.Read(vb); e == nil {
		vtoken := hex.EncodeToString(vb)
		_, e2 := db.DB.Exec(
			"INSERT INTO verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
			created.ID, vtoken, time.Now().Add(24*time.Hour),
		)
		if e2 == nil {
			base := os.Getenv("FRONTEND_URL")
			if base == "" {
				base = "https://www.tehuti.net"
			}
			if e3 := utils.SendVerificationEmail(user.Email, base+"/verify?token="+vtoken); e3 != nil {
				c.Logger().Errorf("verification email failed: %v", e3)
			}
		}
	}

	return c.JSON(http.StatusCreated, created)
}

type loginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Login(c echo.Context) error {
	var input loginInput
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	var user models.User
	err := db.DB.QueryRow(
		"SELECT id, username, password FROM users WHERE email = $1",
		input.Email,
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

// VerifyEmail confirms an account via the emailed token, then sends a welcome email.
func VerifyEmail(c echo.Context) error {
	token := c.QueryParam("token")
	if token == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Missing token"})
	}

	var userID int
	var expiresAt time.Time
	var used bool
	err := db.DB.QueryRow(
		"SELECT user_id, expires_at, used FROM verification_tokens WHERE token = $1",
		token,
	).Scan(&userID, &expiresAt, &used)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid verification link"})
	}
	if used || time.Now().After(expiresAt) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "This verification link has expired or been used"})
	}

	if _, err := db.DB.Exec("UPDATE users SET verified = TRUE WHERE id = $1", userID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Could not verify account"})
	}
	db.DB.Exec("UPDATE verification_tokens SET used = TRUE WHERE token = $1", token)

	// Welcome email — fire on successful verification (non-fatal)
	var email string
	if db.DB.QueryRow("SELECT email FROM users WHERE id = $1", userID).Scan(&email) == nil && email != "" {
		if e := utils.SendWelcomeEmail(email); e != nil {
			c.Logger().Errorf("welcome email failed: %v", e)
		}
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Email verified. You can now see predictions."})
}

// ResendVerification re-sends the verification email for the logged-in user.
func ResendVerification(c echo.Context) error {
	userID := c.Get("user_id")

	var email string
	var verified bool
	err := db.DB.QueryRow("SELECT email, verified FROM users WHERE id = $1", userID).Scan(&email, &verified)
	if err != nil || email == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "No email on file"})
	}
	if verified {
		return c.JSON(http.StatusOK, map[string]string{"message": "Already verified"})
	}

	vb := make([]byte, 32)
	if _, e := rand.Read(vb); e != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Could not generate token"})
	}
	vtoken := hex.EncodeToString(vb)
	if _, e := db.DB.Exec(
		"INSERT INTO verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
		userID, vtoken, time.Now().Add(24*time.Hour),
	); e != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Could not create token"})
	}

	base := os.Getenv("FRONTEND_URL")
	if base == "" {
		base = "https://www.tehuti.net"
	}
	if e := utils.SendVerificationEmail(email, base+"/verify?token="+vtoken); e != nil {
		c.Logger().Errorf("resend verification failed: %v", e)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Could not send email"})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "Verification email sent"})
}
