package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"match-predictor/db"
	"match-predictor/utils"

	"github.com/labstack/echo/v4"
	"google.golang.org/api/idtoken"
)

type googleAuthRequest struct {
	Credential string `json:"credential"`
}

// deriveUsername turns an email into a reasonable starting username.
func deriveUsername(email, name string) string {
	if at := strings.Index(email, "@"); at > 0 {
		return strings.ToLower(email[:at])
	}
	if name != "" {
		return strings.ToLower(strings.ReplaceAll(name, " ", ""))
	}
	return "user"
}

// GoogleAuth verifies a Google ID token, finds or creates the matching user,
// and returns one of OUR JWTs — so everything downstream is unchanged.
func GoogleAuth(c echo.Context) error {
	var req googleAuthRequest
	if err := c.Bind(&req); err != nil || req.Credential == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Missing credential"})
	}

	clientID, _ := c.Get("google_client_id").(string)
	if clientID == "" {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Google sign-in not configured"})
	}

	// Verifies signature, expiry, issuer and audience against Google's keys
	payload, err := idtoken.Validate(c.Request().Context(), req.Credential, clientID)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid Google token"})
	}

	sub, _ := payload.Claims["sub"].(string)
	email, _ := payload.Claims["email"].(string)
	name, _ := payload.Claims["name"].(string)
	if sub == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid Google token"})
	}

	var userID int
	var username string

	// Returning user?
	err = db.DB.QueryRow(
		"SELECT id, username FROM users WHERE provider = 'google' AND provider_id = $1",
		sub,
	).Scan(&userID, &username)

	if err == sql.ErrNoRows {
		// New user — usernames are unique, so retry with a suffix on collision
		base := deriveUsername(email, name)
		for attempt := 0; attempt < 5; attempt++ {
			candidate := base
			if attempt > 0 {
				candidate = fmt.Sprintf("%s%d", base, attempt+1)
			}
			insertErr := db.DB.QueryRow(
				`INSERT INTO users (username, provider, provider_id, email)
				 VALUES ($1, 'google', $2, $3) RETURNING id, username`,
				candidate, sub, email,
			).Scan(&userID, &username)
			if insertErr == nil {
				break
			}
			if attempt == 4 {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Could not create account"})
			}
		}
	} else if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}

	token, err := utils.GenerateToken(userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Could not issue token"})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"token":    token,
		"username": username,
	})
}
