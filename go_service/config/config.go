package config

import (
	"os"
)

type Config struct {
	// Database
	DBUrl string

	// JWT
	JWTSecret string

	// Redis
	RedisAddr string

	// RabbitMQ
	RabbitMQURL string

	// Python ML service
	PythonServiceURL string

	// Football Data API
	FootballDataAPIKey string

	// Google OAuth
	GoogleClientID string

	// Allowed browser origins, comma-separated
	CORSOrigins string

	// Server
	Port string
}

func Load() *Config {
	return &Config{
		DBUrl:              getEnv("DB_URL", ""),
		JWTSecret:          getEnv("JWT_SECRET", "supersecretkey"),
		RedisAddr:          getEnv("REDIS_ADDR", "localhost:6379"),
		RabbitMQURL:        getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
		PythonServiceURL:   getEnv("PYTHON_SERVICE_URL", "http://localhost:8001"),
		FootballDataAPIKey: getEnv("FOOTBALL_DATA_API_KEY", ""),
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		CORSOrigins:        getEnv("CORS_ORIGINS", "http://localhost:3000"),
		Port:               getEnv("PORT", "8080"),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
