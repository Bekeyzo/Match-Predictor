package models

type Team struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type Fixture struct {
	ID          int    `json:"id"`
	HomeTeam    Team   `json:"homeTeam"`
	AwayTeam    Team   `json:"awayTeam"`
	Status      string `json:"status"`
	UtcDate     string `json:"utcDate"`
	Competition struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
		Code string `json:"code"`
	} `json:"competition"`
}

type FixturesResponse struct {
	Matches []Fixture `json:"matches"`
}

type League struct {
	Code string `json:"code"`
	Name string `json:"name"`
	Flag string `json:"flag"`
}
