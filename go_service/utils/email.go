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

// SendVerificationEmail sends an account-verification link via Resend.
func SendVerificationEmail(toEmail, verifyLink string) error {
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
  <h2 style="color:#7F77DD">Confirm your email</h2>
  <p>Welcome to Tehuti.AI. Confirm your email to unlock match predictions across 14 leagues. This link expires in 24 hours.</p>
  <p style="margin:28px 0">
    <a href="%s" style="background:#7F77DD;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Confirm email</a>
  </p>
  <p style="color:#666;font-size:13px">If you didn't create a Tehuti.AI account, you can ignore this email.</p>
  <p style="color:#999;font-size:12px;margin-top:24px">Tehuti.AI — model-led football predictions</p>
</div>`, verifyLink)

	body, _ := json.Marshal(map[string]interface{}{
		"from":    fmt.Sprintf("Tehuti.AI <%s>", from),
		"to":      []string{toEmail},
		"subject": "Confirm your Tehuti.AI email",
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

// SendWelcomeEmail greets a newly-verified user.
func SendWelcomeEmail(toEmail string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		return fmt.Errorf("RESEND_API_KEY not set")
	}
	from := os.Getenv("RESET_FROM_EMAIL")
	if from == "" {
		from = "noreply@tehuti.net"
	}

	html := `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
  <h2 style="color:#7F77DD">Welcome to Tehuti.AI</h2>
  <p>Your email's confirmed and predictions are unlocked. Tehuti gives you model-led forecasts across 14 leagues — match outcomes, goals markets, and BTTS, with a transparent accuracy tracker so you can see how the model performs.</p>
  <p style="margin:28px 0">
    <a href="https://www.tehuti.net" style="background:#7F77DD;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">See today's predictions</a>
  </p>
  <p style="color:#999;font-size:12px;margin-top:24px">Tehuti.AI — model-led football predictions. Predictions are estimates, not guarantees.</p>
</div>`

	body, _ := json.Marshal(map[string]interface{}{
		"from":    fmt.Sprintf("Tehuti.AI <%s>", from),
		"to":      []string{toEmail},
		"subject": "Welcome to Tehuti.AI — predictions unlocked",
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
