import re
import math
import requests
import unicodedata
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
import joblib

# Path to the data folder where CSV files are stored
DATA_DIR = Path(__file__).parent / "data"

# Where trained models are persisted between restarts
MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)


def model_path(league_code: str) -> Path:
    return MODELS_DIR / f"{league_code}.joblib"


def save_model(league_code: str, model, le, stats=None):
    """Freeze the trained model, label encoder and its scores to disk."""
    joblib.dump((model, le, stats or {}), model_path(league_code))


def load_saved_model(league_code: str):
    """Thaw a saved model from disk. Returns (model, le) or None."""
    p = model_path(league_code)
    if p.exists():
        loaded = joblib.load(p)
        # Older saves were 2-tuples with no stats — force a retrain for those
        if isinstance(loaded, tuple) and len(loaded) == 3:
            return loaded
        return None
    return None

# ─────────────────────────────────────────────
# TEAM NAME MATCHING (fuzzy / canonical)
# football-data.org sends full names ("FC Bayern München"),
# CSVs use short names ("Bayern Munich"). Instead of hardcoding every
# pair, we reduce BOTH sides to a canonical core and match on that.
# Works across all leagues and survives promotions.
# ─────────────────────────────────────────────
# Only TRUE noise — corporate/legal suffixes and generic filler.
# Deliberately NOT included: "united", "city", "town", "athletic", "albion",
# "wanderers", "rovers", etc. — those DISTINGUISH clubs in the same city
# (Manchester United vs Manchester City), so stripping them causes collisions.
_NOISE_WORDS = {
    "fc", "cf", "afc", "sc", "ac", "as", "ss", "us", "rc", "cd",
    "club", "calcio", "sporting", "olympique", "deportivo",
}


# City/place tokens shared by multiple clubs — these alone can't justify a
# match (e.g. "Barcelona" is in both FC Barcelona and Espanyol de Barcelona).
_PLACE_TOKENS = {
    "barcelona", "madrid", "manchester", "sheffield", "london",
    "nottingham", "bilbao", "sevilla", "roma", "milano", "torino",
}

_PREFIX_ALIASES = {
    "man": "manchester",
    "wolves": "wolverhampton",
    "spurs": "tottenham",
    "nottm": "nottingham",
    "sheff": "sheffield",
}


def _tokens(name: str) -> frozenset:
    """
    Reduce a team name to a SET of meaningful tokens (not a concatenated
    string), so "Man United" and "Manchester United FC" share
    {manchester, united}. Distinguishing words like "united"/"city" are
    KEPT — they separate two clubs in the same city.
    """
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = name.lower()
    name = "".join(c if c.isalnum() or c.isspace() else " " for c in name)
    toks = set()
    for t in name.split():
        if not t or t in _NOISE_WORDS:
            continue
        toks.add(_PREFIX_ALIASES.get(t, t))
    return frozenset(toks)


def _canon(name: str) -> str:
    """Legacy string form (kept for callers): sorted tokens joined."""
    return "".join(sorted(_tokens(name)))


def build_name_index(all_data: pd.DataFrame) -> dict:
    """
    Build a lookup from canonical form -> exact CSV name,
    for every team that appears in this league's data.
    """
    csv_names = set(all_data["HomeTeam"]) | set(all_data["AwayTeam"])
    index = {}
    for csv_name in csv_names:
        index[_canon(csv_name)] = csv_name
    return index


def resolve_team(org_name: str, index: dict) -> str:
    """
    Translate a football-data.org name to the matching CSV name.

    Strategy:
      1. An explicit map pins the genuinely ambiguous famous clubs (two clubs
         sharing a city, or names that don't share tokens with the CSV form).
         A value of None means "known to have no data" -> honest zeros.
      2. Otherwise, TOKEN-SET containment: the smaller name's tokens must be
         fully contained in the larger, AND neither side may carry a
         distinguishing identity token (a non-place token) the other lacks.
         So "FC Barcelona"->"Barcelona" (only a shared place, no extra identity)
         but "Espanyol de Barcelona" never matches "Barcelona" (extra identity
         "espanyol"), and "Man United" never matches "Man City".
    """
    # 1. Explicit pins for ambiguous / non-token-sharing clubs.
    explicit = {
        # England
        "manchester united fc": "Man United",
        "manchester city fc": "Man City",
        "brighton & hove albion fc": "Brighton",
        "coventry city fc": "Coventry",
        "hull city afc": "Hull",
        "ipswich town fc": "Ipswich",
        "leeds united fc": "Leeds",
        "newcastle united fc": "Newcastle",
        "nottingham forest fc": "Nott'm Forest",
        "tottenham hotspur fc": "Tottenham",
        # Spain
        "atletico madrid": "Ath Madrid",
        "atletico de madrid": "Ath Madrid",
        "club atletico de madrid": "Ath Madrid",
        "club atlético de madrid": "Ath Madrid",
        "fc barcelona": "Barcelona",
        # Espanyol: the CSV spells it "Espanol" (no y) — the old pins pointed at
        # "Espanyol" which is NOT in the data, so they silently failed.
        "rcd espanyol de barcelona": "Espanol",
        "rcd espanyol": "Espanol",
        "espanyol": "Espanol",
        # verified org long-name -> CSV short-name pins (checked against PD data)
        "athletic club": "Ath Bilbao",
        "ca osasuna": "Osasuna",
        "levante ud": "Levante",
        "rc celta de vigo": "Celta",
        "rayo vallecano de madrid": "Vallecano",
        "real betis balompié": "Betis",
        "real betis balompie": "Betis",
        "real racing club de santander": "Santander",
        "real sociedad de fútbol": "Sociedad",
        "real sociedad de futbol": "Sociedad",
        # France (Ligue 1) — official long names -> CSV short names
        "olympique de marseille": "Marseille",
        "paris saint-germain fc": "Paris SG",
        "paris saint germain fc": "Paris SG",
        "rc strasbourg alsace": "Strasbourg",
        "racing club de lens": "Lens",
        "aj auxerre": "Auxerre",
        "stade brestois 29": "Brest",
        "angers sco": "Angers",
        "lille osc": "Lille",
        "stade rennais fc 1901": "Rennes",
        "stade rennais fc": "Rennes",
        "olympique lyonnais": "Lyon",
        "ogc nice": "Nice",
        "toulouse fc": "Toulouse",
        "fc lorient": "Lorient",
        "as monaco fc": "Monaco",
        "le havre ac": "Le Havre",
        "fc metz": "Metz",
        "fc nantes": "Nantes",
        "es troyes ac": "Troyes",
        # Netherlands (Eredivisie)
        "feyenoord rotterdam": "Feyenoord",
        "az": "AZ Alkmaar",
        "fortuna sittard": "For Sittard",
        "sc cambuur-leeuwarden": "Cambuur",
        "sc cambuur": "Cambuur",
        "nec": "Nijmegen",
        "sbv excelsior": "Excelsior",
        "psv": "PSV Eindhoven",
        "sc heerenveen": "Heerenveen",
        "pec zwolle": "Zwolle",
        "fc groningen": "Groningen",
        "fc utrecht": "Utrecht",
        "fc twente": "Twente",
        "go ahead eagles": "Go Ahead Eagles",
        "ado den haag": "Den Haag",
        "fc twente '65": "Twente",
        "telstar 1963": "Telstar",
        "willem ii tilburg": "Willem II",
        # Portugal (Primeira Liga) — two Sportings, keep distinct
        "sporting clube de portugal": "Sp Lisbon",
        "sporting cp": "Sp Lisbon",
        "sporting lisbon": "Sp Lisbon",
        "sporting clube de braga": "Sp Braga",
        "sc braga": "Sp Braga",
        # verified org long-name -> CSV short-name pins (checked against PPL data)
        "académico de viseu fc": "Academico Viseu",
        "academico de viseu fc": "Academico Viseu",
        "cf estrela da amadora": "Estrela",
        "cs marítimo": "Maritimo",
        "cs maritimo": "Maritimo",
        "gd estoril praia": "Estoril",
        "sport lisboa e benfica": "Benfica",
        "vitória sc": "Guimaraes",
        "vitoria sc": "Guimaraes",
        # Italy (Serie A) — long -> CSV short; Inter is "Inter" NOT "Milan" (derby trap)
        "acf fiorentina": "Fiorentina",
        "atalanta bc": "Atalanta",
        "bologna fc 1909": "Bologna",
        "como 1907": "Como",
        "fc internazionale milano": "Inter",
        "genoa cfc": "Genoa",
        "parma calcio 1913": "Parma",
        "ssc napoli": "Napoli",
        # Germany (Bundesliga) — official long names -> CSV short names
        "fc bayern munchen": "Bayern Munich",
        "fc bayern münchen": "Bayern Munich",
        "bayern munchen": "Bayern Munich",
        "bayern münchen": "Bayern Munich",
        "vfb stuttgart": "Stuttgart",
        "borussia dortmund": "Dortmund",
        "bvb": "Dortmund",
        "bayer 04 leverkusen": "Leverkusen",
        "bayer leverkusen": "Leverkusen",
        "borussia monchengladbach": "M'gladbach",
        "borussia mönchengladbach": "M'gladbach",
        "eintracht frankfurt": "Ein Frankfurt",
        "1. fc koln": "FC Koln",
        "1. fc köln": "FC Koln",
        "fc koln": "FC Koln",
        "fc köln": "FC Koln",
        "sv werder bremen": "Werder Bremen",
        "werder bremen": "Werder Bremen",
        "vfl wolfsburg": "Wolfsburg",
        "tsg 1899 hoffenheim": "Hoffenheim",
        "tsg hoffenheim": "Hoffenheim",
        "sc freiburg": "Freiburg",
        "1. fsv mainz 05": "Mainz",
        "fsv mainz 05": "Mainz",
        "mainz 05": "Mainz",
        "rb leipzig": "RB Leipzig",
        "fc augsburg": "Augsburg",
        "1. fc union berlin": "Union Berlin",
        "union berlin": "Union Berlin",
        "1. fc heidenheim 1846": "Heidenheim",
        "1. fc heidenheim": "Heidenheim",
        "fc st. pauli": "St Pauli",
        "fc st pauli": "St Pauli",
        "st. pauli": "St Pauli",
        "hamburger sv": "Hamburg",
        "fc schalke 04": "Schalke 04",
        "holstein kiel": "Holstein Kiel",
        "vfl bochum": "Bochum",
        "hertha bsc": "Hertha",
        "sv darmstadt 98": "Darmstadt",
        # Championship (England) — long -> CSV short
        "bolton wanderers fc": "Bolton",
        "lincoln city fc": "Lincoln",
        "west ham united fc": "West Ham",
        "wolverhampton wanderers fc": "Wolves",
        "charlton athletic fc": "Charlton",
        "derby county fc": "Derby",
        "cardiff city fc": "Cardiff",
        "queens park rangers fc": "QPR",
        "birmingham city fc": "Birmingham",
        "bristol city fc": "Bristol City",
        "west bromwich albion fc": "West Brom",
        "blackburn rovers fc": "Blackburn",
        "swansea city afc": "Swansea",
        "norwich city fc": "Norwich",
        "stoke city fc": "Stoke",
        "preston north end fc": "Preston",
        "middlesbrough fc": "Middlesbrough",
    }
    pin = explicit.get(org_name.strip().lower())
    if pin is not None:
        # Only use the pin if that CSV name actually exists in this league's
        # index; otherwise fall through (pin may be for a team with no data).
        if pin in index.values():
            return pin
        # pinned name not in data -> honest no-match (zeros)
        return org_name

    want = _tokens(org_name)
    if not want:
        return org_name
    best_name = None
    best_score = 0.0
    for csv_name in index.values():
        have = _tokens(csv_name)
        if not have:
            continue
        inter = want & have
        smaller = min(len(want), len(have))
        if len(inter) != smaller:
            continue
        # Neither side may carry an identity (non-place) token the other lacks.
        want_id = want - _PLACE_TOKENS
        have_id = have - _PLACE_TOKENS
        if want_id ^ have_id:
            continue
        # And the overlap must include at least one real token (guard).
        if not inter:
            continue
        score = len(inter) / max(len(want), len(have))
        if score > best_score:
            best_score = score
            best_name = csv_name
    return best_name if best_name is not None else org_name


# ─────────────────────────────────────────────
# LEAGUE CONFIGURATION
# ─────────────────────────────────────────────

DATA_URLS = {
    "PL":   "https://www.football-data.co.uk/mmz4281/{season}/E0.csv",
    "ELC":  "https://www.football-data.co.uk/mmz4281/{season}/E1.csv",
    "PD":   "https://www.football-data.co.uk/mmz4281/{season}/SP1.csv",
    "PD2":  "https://www.football-data.co.uk/mmz4281/{season}/SP2.csv",
    "BL1":  "https://www.football-data.co.uk/mmz4281/{season}/D1.csv",
    "BL2":  "https://www.football-data.co.uk/mmz4281/{season}/D2.csv",
    "SA":   "https://www.football-data.co.uk/mmz4281/{season}/I1.csv",
    "SB":   "https://www.football-data.co.uk/mmz4281/{season}/I2.csv",
    "FL1":  "https://www.football-data.co.uk/mmz4281/{season}/F1.csv",
    "FL2":  "https://www.football-data.co.uk/mmz4281/{season}/F2.csv",
    "DED":  "https://www.football-data.co.uk/mmz4281/{season}/N1.csv",
    "DED2": "https://www.football-data.co.uk/mmz4281/{season}/N2.csv",
    "PPL":  "https://www.football-data.co.uk/mmz4281/{season}/P1.csv",
    "PPL2": "https://www.football-data.co.uk/mmz4281/{season}/P2.csv",
    "SPL":  "https://www.football-data.co.uk/mmz4281/{season}/SC0.csv",
    "SPL2": "https://www.football-data.co.uk/mmz4281/{season}/SC1.csv",
    "BEL":  "https://www.football-data.co.uk/mmz4281/{season}/B1.csv",
    "BEL2": "https://www.football-data.co.uk/mmz4281/{season}/B2.csv",
    "GSL":  "https://www.football-data.co.uk/mmz4281/{season}/G1.csv",
    "GSL2": "https://www.football-data.co.uk/mmz4281/{season}/G2.csv",
}

def current_seasons(n=5):
    """Football-data.co.uk season codes, newest first, e.g. ["2627","2526",...].
    The season starts in July, so before July we're still in the season that
    began the previous calendar year. Rolls forward automatically each year."""
    now = datetime.now()
    start = now.year if now.month >= 7 else now.year - 1
    return [f"{(start - i) % 100:02d}{(start - i + 1) % 100:02d}" for i in range(n)]

SEASONS = current_seasons()

# Build the per-league training-file lists from the active seasons, so the
# download loop (SEASONS) and the load loop (LEAGUE_FILES) can never drift.
LEAGUE_FILES = {
    lg: [f"{lg}_{s[:2]}:{s[2:]}.csv" for s in SEASONS]
    for lg in DATA_URLS
}


# ─────────────────────────────────────────────
# AUTO-DOWNLOAD
# ─────────────────────────────────────────────
def download_league_data(league_code: str):
    if league_code not in DATA_URLS:
        raise ValueError(f"Unknown league code: {league_code}")

    url_template = DATA_URLS[league_code]
    downloaded = []

    for season in SEASONS:
        url = url_template.format(season=season)
        filename = f"{league_code}_{season[:2]}:{season[2:]}.csv"
        filepath = DATA_DIR / filename

        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200 and len(response.content) > 100:
                filepath.write_bytes(response.content)
                downloaded.append(filename)
                print(f"Downloaded: {filename}")
            else:
                print(f"Skipped {filename} — no data available yet")
        except Exception as e:
            print(f"Failed to download {filename}: {e}")

    return downloaded


# ─────────────────────────────────────────────
# DATA LOADER
# CSV team names are left as-is; we translate the incoming fixture name
# to match them at prediction time instead.
# ─────────────────────────────────────────────
def load_league_data(league_code: str) -> pd.DataFrame:
    files = LEAGUE_FILES.get(league_code, [])
    frames = []

    for filename in files:
        filepath = DATA_DIR / filename
        if not filepath.exists():
            print(f"File not found, skipping: {filename}")
            continue
        try:
            df = pd.read_csv(filepath)
            frames.append(df)
        except Exception as e:
            print(f"Error reading {filename}: {e}")

    if not frames:
        raise ValueError(f"No data found for league: {league_code}")

    all_data = pd.concat(frames, ignore_index=True)
    all_data['Date'] = pd.to_datetime(all_data['Date'], dayfirst=True, errors='coerce')
    all_data = all_data.dropna(subset=['Date', 'FTHG', 'FTAG']).reset_index(drop=True)
    all_data = all_data.sort_values(by='Date').reset_index(drop=True)
    return all_data


# ─────────────────────────────────────────────
# POISSON MATH
# ─────────────────────────────────────────────
def poisson_pmf(k, lam):
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    return (lam ** k) * math.exp(-lam) / math.factorial(k)


def scoreline_probs(exp_home, exp_away, max_goals=8):
    probs = {}
    total = 0.0
    for i in range(max_goals + 1):
        for j in range(max_goals + 1):
            p = poisson_pmf(i, exp_home) * poisson_pmf(j, exp_away)
            probs[(i, j)] = p
            total += p
    if total > 0:
        for k in probs:
            probs[k] /= total
    return probs


# ─────────────────────────────────────────────
# FEATURE EXTRACTION
# ─────────────────────────────────────────────
def get_recent_features(all_data: pd.DataFrame, team: str, date, n: int = 5):
    # Normalize whatever the caller passes (date / datetime / str) to a
    # Timestamp so the comparison against the datetime64 column always works.
    date = pd.to_datetime(date)
    recent = all_data[
        ((all_data['HomeTeam'] == team) | (all_data['AwayTeam'] == team)) &
        (all_data['Date'] < date)
    ].sort_values(by='Date', ascending=False).head(n)

    if recent.empty:
        return {
            'gf': 0.0, 'ga': 0.0,
            'corners_for': 0.0, 'corners_against': 0.0,
            'cards_for': 0.0, 'cards_against': 0.0,
            'sot_for': 0.0, 'sot_against': 0.0,
            'shots_for': 0.0, 'shots_against': 0.0,
            'fouls_for': 0.0, 'fouls_against': 0.0,
            'match_count': 0
        }

    gf = ga = corners_for = cards_for = sot_for = shots_for = fouls_for = 0.0
    count = 0

    for _, m in recent.iterrows():
        count += 1
        if m['HomeTeam'] == team:
            gf += m['FTHG']
            ga += m['FTAG']
        else:
            gf += m['FTAG']
            ga += m['FTHG']

        if 'HC' in m and not pd.isna(m.get('HC')):
            corners_for += m.get('HC', 0) if m['HomeTeam'] == team else m.get('AC', 0)

        home_cards = m.get('HY', 0) + m.get('HR', 0)
        away_cards = m.get('AY', 0) + m.get('AR', 0)
        cards_for += home_cards if m['HomeTeam'] == team else away_cards

        if 'HST' in m and not pd.isna(m.get('HST')):
            sot_for += m.get('HST', 0) if m['HomeTeam'] == team else m.get('AST', 0)

        if 'HS' in m and not pd.isna(m.get('HS')):
            shots_for += m.get('HS', 0) if m['HomeTeam'] == team else m.get('AS', 0)

        if 'HF' in m and not pd.isna(m.get('HF')):
            fouls_for += m.get('HF', 0) if m['HomeTeam'] == team else m.get('AF', 0)

    ca = cb = csot = cshots = cfouls = 0.0
    ccount = 0
    for _, m in recent.iterrows():
        ccount += 1
        if m['HomeTeam'] == team:
            ca += m.get('AC', 0)
            cb += m.get('AY', 0) + m.get('AR', 0)
            csot += m.get('AST', 0)
            cshots += m.get('AS', 0)
            cfouls += m.get('AF', 0)
        else:
            ca += m.get('HC', 0)
            cb += m.get('HY', 0) + m.get('HR', 0)
            csot += m.get('HST', 0)
            cshots += m.get('HS', 0)
            cfouls += m.get('HF', 0)

    real_count = count  # true number of recent matches, before the floor below
    count = max(count, 1)
    ccount = max(ccount, 1)

    return {
        'gf': gf / count,
        'ga': ga / count,
        'corners_for': corners_for / count,
        'corners_against': ca / ccount,
        'cards_for': cards_for / count,
        'cards_against': cb / ccount,
        'sot_for': sot_for / count,
        'sot_against': csot / ccount,
        'shots_for': shots_for / count,
        'shots_against': cshots / ccount,
        'fouls_for': fouls_for / count,
        'fouls_against': cfouls / ccount,
        'match_count': real_count
    }


# ─────────────────────────────────────────────
# MODEL TRAINING
# ─────────────────────────────────────────────
def train_model(all_data: pd.DataFrame):
    features_all = []
    labels_all = []

    all_data['result'] = all_data.apply(
        lambda r: 'H' if r['FTHG'] > r['FTAG'] else ('A' if r['FTHG'] < r['FTAG'] else 'D'),
        axis=1
    )

    le = LabelEncoder()
    all_data['result_encoded'] = le.fit_transform(all_data['result'])

    for _, row in all_data.iterrows():
        hf = get_recent_features(all_data, row['HomeTeam'], row['Date'])
        af = get_recent_features(all_data, row['AwayTeam'], row['Date'])
        feat = [
            hf['gf'], hf['ga'], af['gf'], af['ga'],
            hf['corners_for'], af['corners_for'],
            hf['cards_for'], af['cards_for'],
            hf['sot_for'], af['sot_for']
        ]
        features_all.append(feat)
        labels_all.append(row['result_encoded'])

    X = np.array(features_all)
    y = np.array(labels_all)
    X = np.nan_to_num(X, nan=0.0)

    X_tr, X_val, y_tr, y_val = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = LogisticRegression(max_iter=500)
    model.fit(X_tr, y_tr)

    # Honest scoring: held-out matches the model never saw during training
    val_preds = model.predict(X_val)
    val_acc = float((val_preds == y_val).mean())

    # Naive baseline — always guess the most common outcome (usually a home win)
    counts = np.bincount(y_tr)
    most_common = int(np.argmax(counts))
    baseline_acc = float((y_val == most_common).mean())

    stats = {
        "accuracy": round(val_acc * 100, 1),
        "baseline": round(baseline_acc * 100, 1),
        "tested": int(len(y_val)),
        "trained": int(len(y_tr)),
    }

    return model, le, stats


# ─────────────────────────────────────────────
# PREDICTION
# Now takes name_index so it can translate the incoming fixture name
# to the CSV's spelling before looking up history.
# ─────────────────────────────────────────────

def get_h2h_from_data(home, away, all_data, name_index, limit=5):
    """Last `limit` head-to-head meetings between two teams, from already-loaded
    league data. Both orientations. Read-only. Returns a list of dicts."""
    h = resolve_team(home, name_index)
    a = resolve_team(away, name_index)
    d = all_data
    mask = (((d['HomeTeam'] == h) & (d['AwayTeam'] == a)) |
            ((d['HomeTeam'] == a) & (d['AwayTeam'] == h)))
    rows = d[mask].sort_values('Date').tail(limit).iloc[::-1]
    out = []
    for _, r in rows.iterrows():
        if r['FTR'] == 'D':
            winner = 'Draw'
        else:
            winner = r['HomeTeam'] if r['FTR'] == 'H' else r['AwayTeam']
        out.append({
            'date': str(r['Date'])[:10],
            'home': r['HomeTeam'],
            'away': r['AwayTeam'],
            'score': f"{int(r['FTHG'])}-{int(r['FTAG'])}",
            'winner': winner,
        })
    return out


def get_h2h_at_venue(home_side, away_side, all_data, name_index, limit=5):
    """Last `limit` meetings between the two teams played at `home_side`'s
    ground (home_side home, away_side away). Read-only."""
    h = resolve_team(home_side, name_index)
    a = resolve_team(away_side, name_index)
    d = all_data
    rows = d[(d['HomeTeam'] == h) & (d['AwayTeam'] == a)].sort_values('Date').tail(limit).iloc[::-1]
    out = []
    for _, r in rows.iterrows():
        if r['FTR'] == 'D':
            winner = 'Draw'
        else:
            winner = r['HomeTeam'] if r['FTR'] == 'H' else r['AwayTeam']
        out.append({
            'date': str(r['Date'])[:10],
            'home': r['HomeTeam'],
            'away': r['AwayTeam'],
            'score': f"{int(r['FTHG'])}-{int(r['FTAG'])}",
            'winner': winner,
        })
    return out

def predict_fixture(
    home_team: str,
    away_team: str,
    target_date,
    all_data: pd.DataFrame,
    model: LogisticRegression,
    le: LabelEncoder,
    name_index: dict,
) -> dict:
    # Translate football-data.org names to CSV names via fuzzy matching
    home = resolve_team(home_team, name_index)
    away = resolve_team(away_team, name_index)

    hf = get_recent_features(all_data, home, target_date)
    af = get_recent_features(all_data, away, target_date)

    # FAIL-SAFE: if a resolved team isn't in this league's data at all (a name
    # that didn't map, or a team with no historical rows), we have nothing to
    # compute from. Return an honest "insufficient data" flag instead of a fake
    # 0-0 that looks like a real prediction.
    known = set(all_data['HomeTeam'].dropna()) | set(all_data['AwayTeam'].dropna())
    missing = [orig for orig, res in ((home_team, home), (away_team, away)) if res not in known]
    # FOSSIL GUARD: a team resolved into the data but with ZERO recent matches
    # before this date has no form to compute from — the recency window came back
    # empty (this is exactly what the old date-comparison bug produced, and what
    # froze fake 0-0 "fossil" predictions into the table). Treat it as no data
    # rather than emitting a fake scoreline.
    if not missing:
        no_form = [orig for orig, feats in ((home_team, hf), (away_team, af)) if feats.get('match_count', 0) == 0]
        if no_form:
            missing = no_form
    if missing:
        return {
            "insufficient_data": True,
            "reason": "No historical match data for: " + ", ".join(missing),
            "fixture": f"{home_team} vs {away_team}",
            "home_team": home_team,
            "away_team": away_team,
        }

    feat = [
        hf['gf'], hf['ga'], af['gf'], af['ga'],
        hf['corners_for'], af['corners_for'],
        hf['cards_for'], af['cards_for'],
        hf['sot_for'], af['sot_for']
    ]

    X = np.array([feat])
    X = np.nan_to_num(X, nan=0.0)

    pred_probs = model.predict_proba(X)[0]
    pred_class = model.predict(X)[0]
    pred_text = le.inverse_transform([pred_class])[0]
    prob_map = {label: float(pred_probs[idx]) for idx, label in enumerate(le.classes_)}

    exp_home = (hf['gf'] + af['ga']) / 2
    exp_away = (af['gf'] + hf['ga']) / 2

    probs = scoreline_probs(exp_home, exp_away)
    most_likely = max(probs.items(), key=lambda kv: kv[1])[0]

    return {
        "fixture": f"{home} vs {away}",
        "home_team": home,
        "away_team": away,
        "predicted_result": pred_text,
        "home_win_prob_pct": round(prob_map.get('H', 0.0) * 100, 2),
        "draw_prob_pct": round(prob_map.get('D', 0.0) * 100, 2),
        "away_win_prob_pct": round(prob_map.get('A', 0.0) * 100, 2),
        "expected_home_goals": round(exp_home, 3),
        "expected_away_goals": round(exp_away, 3),
        "most_likely_score": f"{most_likely[0]}-{most_likely[1]}",
        "prob_most_likely_score_pct": round(probs[most_likely] * 100, 2),
        "btts_prob_pct": round(sum(p for (i, j), p in probs.items() if i > 0 and j > 0) * 100, 2),
        "expected_total_goals": round(sum((i + j) * p for (i, j), p in probs.items()), 3),
        "prob_over_2_5_pct": round(sum(p for (i, j), p in probs.items() if (i + j) > 2.5) * 100, 2),
        "prob_over_1_5_pct": round(sum(p for (i, j), p in probs.items() if (i + j) > 1.5) * 100, 2),
        "prob_over_3_5_pct": round(sum(p for (i, j), p in probs.items() if (i + j) > 3.5) * 100, 2),
        "expected_home_corners": round(hf['corners_for'], 2),
        "expected_away_corners": round(af['corners_for'], 2),
        "expected_total_corners": round(hf['corners_for'] + af['corners_for'], 2),
        "expected_home_cards": round(hf['cards_for'], 2),
        "expected_away_cards": round(af['cards_for'], 2),
        "expected_total_cards": round(hf['cards_for'] + af['cards_for'], 2),
        "expected_home_shots": round(hf['shots_for'], 2),
        "expected_away_shots": round(af['shots_for'], 2),
        "expected_total_shots": round(hf['shots_for'] + af['shots_for'], 2),
        "expected_home_fouls": round(hf['fouls_for'], 2),
        "expected_away_fouls": round(af['fouls_for'], 2),
        "expected_total_fouls": round(hf['fouls_for'] + af['fouls_for'], 2),
        "expected_home_sot": round(hf['sot_for'], 2),
        "expected_away_sot": round(af['sot_for'], 2),
        "expected_total_sot": round(hf['sot_for'] + af['sot_for'], 2),
    }