package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// SendResetEmail sends a password-reset link via Resend's API.
func SendResetEmail(toEmail, resetLink string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		return fmt.Errorf("RESEND_API_KEY not set")
	}

	from := os.Getenv("RESET_FROM_EMAIL")
	if from == "" {
		from = "noreply@tehuti.net"
	}

	html := fmt.Sprintf(`
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
  <h2 style="color:#7F77DD">Reset your Tehuti.AI password</h2>
  <p>We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.</p>
  <p style="margin:28px 0">
    <a href="%s" style="background:#7F77DD;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a>
  </p>
  <p style="color:#666;font-size:13px">If you didn't request this, you can safely ignore this email — your password won't change.</p>
  <p style="color:#999;font-size:12px;margin-top:24px">Tehuti.AI — model-led football predictions</p>
</div>`, resetLink)

	body, _ := json.Marshal(map[string]interface{}{
		"from":    fmt.Sprintf("Tehuti.AI <%s>", from),
		"to":      []string{toEmail},
		"subject": "Reset your Tehuti.AI password",
		"html":    html,
	})

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("resend returned %d", resp.StatusCode)
	}
	return nil
}
