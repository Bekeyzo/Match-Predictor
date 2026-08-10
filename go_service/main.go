package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"match-predictor/config"
	"match-predictor/db"
	"match-predictor/handlers"
	"match-predictor/middleware"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	echomiddleware "github.com/labstack/echo/v4/middleware"
	"golang.org/x/time/rate"
)

func main() {
	godotenv.Load()
	cfg := config.Load()

	db.Connect(cfg.DBUrl)
	db.RunMigrations()
	db.ConnectRedis(cfg.RedisAddr)

	e := echo.New()
	e.HideBanner = true

	// Recover MUST come first — without it a single panic in any handler
	// takes down the entire process for every user.
	e.Use(echomiddleware.Recover())
	e.Use(echomiddleware.Logger())

	// Reject oversized bodies before they reach a handler
	e.Use(echomiddleware.BodyLimit("64K"))

	// Only our own frontend may call this API from a browser
	e.Use(echomiddleware.CORSWithConfig(echomiddleware.CORSConfig{
		AllowOrigins: strings.Split(cfg.CORSOrigins, ","),
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodOptions},
		AllowHeaders: []string{echo.HeaderContentType, echo.HeaderAuthorization},
	}))

	// Blanket limit — protects against hammering any endpoint
	e.Use(echomiddleware.RateLimiter(
		echomiddleware.NewRateLimiterMemoryStore(rate.Limit(20)),
	))

	// Much stricter limit for auth routes — brute-forcing passwords is the
	// realistic attack, and 5 attempts a minute makes it useless.
	authLimit := echomiddleware.RateLimiterWithConfig(echomiddleware.RateLimiterConfig{
		Store: echomiddleware.NewRateLimiterMemoryStoreWithConfig(
			echomiddleware.RateLimiterMemoryStoreConfig{
				Rate:      rate.Limit(5.0 / 60.0),
				Burst:     5,
				ExpiresIn: 5 * time.Minute,
			},
		),
	})

	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Set("python_url", cfg.PythonServiceURL)
			c.Set("football_api_key", cfg.FootballDataAPIKey)
			c.Set("google_client_id", cfg.GoogleClientID)
			return next(c)
		}
	})

	// Liveness probe for Docker / any orchestrator
	e.GET("/health", func(c echo.Context) error {
		if err := db.DB.Ping(); err != nil {
			return c.JSON(http.StatusServiceUnavailable, map[string]string{"status": "db down"})
		}
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	// Public
	e.POST("/register", handlers.Register, authLimit)
	e.POST("/login", handlers.Login, authLimit)
	e.POST("/auth/google", handlers.GoogleAuth, authLimit)
	e.POST("/forgot-password", handlers.ForgotPassword, authLimit)
	e.POST("/reset-password", handlers.ResetPassword, authLimit)
	e.GET("/verify", handlers.VerifyEmail, authLimit)
	e.POST("/resend-verification", middleware.AuthMiddleware(handlers.ResendVerification), authLimit)
	e.GET("/leagues", handlers.GetLeagues)
	e.GET("/fixtures/:league", handlers.GetFixtures)
	e.GET("/featured", handlers.GetFeatured)
	e.GET("/accuracy", handlers.GetAccuracy)

	// Protected
	e.POST("/predict", middleware.AuthMiddleware(handlers.GetPrediction))
	e.GET("/me", middleware.AuthMiddleware(handlers.GetMe))
	e.PUT("/me/name", middleware.AuthMiddleware(handlers.UpdateName))
	e.POST("/retrain/:league", middleware.AuthMiddleware(handlers.TriggerRetrain))

	// Start, then wait for a shutdown signal so in-flight requests finish
	go func() {
		log.Println("🚀 Go service running on port", cfg.Port)
		if err := e.Start(":" + cfg.Port); err != nil && err != http.ErrServerClosed {
			log.Fatal("server stopped: ", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("shutting down…")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(ctx); err != nil {
		log.Println("forced shutdown:", err)
	}
}
