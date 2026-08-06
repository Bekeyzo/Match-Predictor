import axios from 'axios';

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
});

// Attach JWT token to every request automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface League {
  code: string;
  name: string;
  flag: string;
}

export interface Team {
  id: number;
  name: string;
}

export interface Fixture {
  id: number;
  homeTeam: Team;
  awayTeam: Team;
  status: string;
  utcDate: string;
  competition: {
    id: number;
    name: string;
    code: string;
  };
}

export interface PredictionResult {
  fixture: string;
  home_team: string;
  away_team: string;
  predicted_result: string;
  home_win_prob_pct: number;
  draw_prob_pct: number;
  away_win_prob_pct: number;
  expected_home_goals: number;
  expected_away_goals: number;
  most_likely_score: string;
  prob_most_likely_score_pct: number;
  btts_prob_pct: number;
  expected_total_goals: number;
  prob_over_2_5_pct: number;
  prob_over_1_5_pct: number;
  prob_over_3_5_pct: number;
  expected_home_corners: number;
  expected_away_corners: number;
  expected_total_corners: number;
  expected_home_cards: number;
  expected_away_cards: number;
  expected_total_cards: number;
}

// Auth
export const register = (username: string, email: string, password: string) =>
  API.post('/register', { username, email, password });

export const login = async (username: string, password: string) => {
  const res = await API.post('/login', { username, password });
  localStorage.setItem('token', res.data.token);
  return res.data;
};

export const logout = () => localStorage.removeItem('token');

// Leagues
export const getLeagues = (): Promise<{ data: League[] }> =>
  API.get('/leagues');

// Fixtures
export const getFixtures = (leagueCode: string): Promise<{ data: { date: string; league: string; fixtures: Fixture[] } }> =>
  API.get(`/fixtures/${leagueCode}`);

// Predictions
export const getPrediction = (
  homeTeam: string,
  awayTeam: string,
  matchDate: string,
  leagueCode: string
): Promise<{ data: { prediction: PredictionResult; cached: boolean } }> =>
  API.post('/predict', {
    home_team: homeTeam,
    away_team: awayTeam,
    match_date: matchDate,
    league_code: leagueCode,
  });
export interface FeaturedFixture {
  id: number;
  home_team: string;
  away_team: string;
  utc_date: string;
  league: string;
  league_name: string;
}

export const getFeatured = (): Promise<{ data: { fixtures: FeaturedFixture[]; cached: boolean } }> =>
  API.get('/featured');
export const googleLogin = (credential: string): Promise<{ data: { token: string; username: string } }> =>
  API.post('/auth/google', { credential });

export interface AccuracyStats {
  overall: number;
  baseline: number;
  tested: number;
  leagues: { league: string; accuracy: number; baseline: number; tested: number }[];
}

export const getAccuracy = (): Promise<{ data: AccuracyStats }> => API.get('/accuracy');
