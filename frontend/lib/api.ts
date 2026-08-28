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

// On 401 (dead/expired token), clear it and send the user to sign in
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

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
  insufficient_data?: boolean;
  reason?: string;
}

// Auth
export const register = (email: string, password: string) =>
  API.post('/register', { email, password });

export const login = async (email: string, password: string) => {
  const res = await API.post('/login', { email, password });
  localStorage.setItem('token', res.data.token);
  return res.data;
};

export const logout = () => localStorage.removeItem('token');

// Leagues
export const getLeagues = (): Promise<{ data: League[] }> =>
  API.get('/leagues');

// Fixtures
export const getFixtures = (leagueCode: string): Promise<{ data: { date: string; league: string; fixtures: Fixture[]; next_fixture_date?: string } }> =>
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
export interface H2HMeeting {
  date: string;
  home: string;
  away: string;
  score: string;
  winner: string;
}

export const getH2H = (
  homeTeam: string,
  awayTeam: string,
  leagueCode: string
): Promise<{ data: { meetings: H2HMeeting[]; home_venue: H2HMeeting[]; away_venue: H2HMeeting[]; home_team: string; away_team: string } }> =>
  API.post('/h2h', {
    home_team: homeTeam,
    away_team: awayTeam,
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

export const forgotPassword = (email: string) =>
  API.post('/forgot-password', { email });

export const resetPassword = (token: string, password: string) =>
  API.post('/reset-password', { token, password });

export const getMe = () =>
  API.get('/me');

export const updateName = (name: string) =>
  API.put('/me/name', { name });

export const verifyEmail = (token: string) =>
  API.get('/verify', { params: { token } });

export const resendVerification = () =>
  API.post('/resend-verification');

export const getPredictionDates = (league: string) =>
  API.get('/predictions/dates', { params: { league } });

export const getPredictionHistory = (league: string, date: string) =>
  API.get('/predictions/history', { params: { league, date } });
