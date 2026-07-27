package db

import (
	"database/sql"
	"log"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/jackc/pgx/v5/stdlib"
)

var DB *sql.DB

func Connect(dbURL string) {
	var err error

	DB, err = sql.Open("pgx", dbURL)
	if err != nil {
		log.Fatal("failed to create database connection: ", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(25)
	DB.SetConnMaxLifetime(5 * time.Minute)

	if err = DB.Ping(); err != nil {
		log.Fatal("database is unreachable: ", err)
	}

	log.Println("✅ Connected to PostgreSQL")
}

func RunMigrations() {
	driver, err := postgres.WithInstance(DB, &postgres.Config{})
	if err != nil {
		log.Fatal("failed to create migration driver: ", err)
	}

	m, err := migrate.NewWithDatabaseInstance(
		"file://db/migrations",
		"postgres",
		driver,
	)
	if err != nil {
		log.Fatal("failed to create migrator: ", err)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatal("failed to run migrations: ", err)
	}

	log.Println("✅ Migrations applied successfully")
}
