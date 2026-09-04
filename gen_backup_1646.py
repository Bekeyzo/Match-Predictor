#!/usr/bin/env python3
"""
gen.py — Tehuti.AI matchday graphics generator.

Pulls this week's real fixtures + real (pre-kickoff, frozen) predictions from the
live API and renders one 1080x1080 broadcast-style PNG per league, ready to post.

HONESTY RULE: every number on a graphic comes from a genuine stored prediction
returned by the live /predict endpoint. Nothing is invented. Games the model
can't predict (insufficient_data) are dropped, never faked.

SAFETY: before rendering anything, the script prints the full fixture + pick list
and PAUSES for you to confirm — so a phantom / wrong-home-away fixture can be
caught before it's published. Run with --yes to skip the pause (not recommended
until the phantom-fixture issue is resolved).

Usage:
    python3 gen.py                 # all leagues, review prompt before rendering
    python3 gen.py --leagues PL PD # only these leagues
    python3 gen.py --days 5        # matchweek window = earliest fixture + N days
    python3 gen.py --yes           # skip the review pause (careful)

Requires: pip install requests pillow
Output: ./graphics/<LEAGUE>_<date>.png
"""

import argparse
import datetime as dt
import os
import sys
from collections import defaultdict

try:
    import requests
except ImportError:
    sys.exit("Missing dependency: pip install requests")
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Missing dependency: pip install pillow")

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
API = os.environ.get("TEHUTI_API", "https://api.tehuti.net")
EMAIL = os.environ.get("TEHUTI_EMAIL", "gfx2@example.com")
PASSWORD = os.environ.get("TEHUTI_PASSWORD", "testpass99")

ALL_LEAGUES = ["PL", "PD", "SA", "BL1", "FL1", "DED", "PPL", "ELC"]

# Brand palette (matches the site's dark theme)
BG = (10, 8, 14)            # warm near-black
PANEL = (22, 18, 30)
PURPLE = (167, 139, 250)    # #A78BFA
INK = (242, 239, 245)       # primary text
INK2 = (170, 165, 180)      # secondary text
HOME_C = (131, 118, 226)    # home purple
DRAW_C = (74, 67, 129)      # draw dark
AWAY_C = (181, 149, 233)    # away light purple
BAR_BG = (40, 35, 52)

W = H = 1080

# ----------------------------------------------------------------------------
# Fonts — fall back gracefully if the nice ones aren't installed
# ----------------------------------------------------------------------------
def load_font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
    ]
    for c in candidates:
        try:
            return ImageFont.truetype(c, size)
        except Exception:
            continue
    return ImageFont.load_default()

# ----------------------------------------------------------------------------
# API
# ----------------------------------------------------------------------------
def login():
    r = requests.post(f"{API}/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    r.raise_for_status()
    tok = r.json().get("token")
    if not tok:
        sys.exit("Login failed — check TEHUTI_EMAIL / TEHUTI_PASSWORD")
    return tok


def get_fixtures(league, token):
    r = requests.get(f"{API}/fixtures/{league}",
                     headers={"Authorization": f"Bearer {token}"}, timeout=30)
    r.raise_for_status()
    return r.json().get("fixtures", []) or []


def get_prediction(home, away, date, league, token):
    r = requests.post(f"{API}/predict",
                      headers={"Authorization": f"Bearer {token}",
                               "Content-Type": "application/json"},
                      json={"home_team": home, "away_team": away,
                            "match_date": date, "league_code": league},
                      timeout=60)
    if r.status_code != 200:
        return None
    body = r.json()
    p = body.get("prediction", body)
    if p.get("insufficient_data"):
        return None
    # a real prediction must carry a pick + probs
    if p.get("predicted_result") is None or p.get("home_win_prob_pct") is None:
        return None
    return p

# ----------------------------------------------------------------------------
# Selection: this matchweek only
# ----------------------------------------------------------------------------
def collect(league, token, days):
    fixtures = get_fixtures(league, token)
    rows = []
    for f in fixtures:
        try:
            home = f["homeTeam"]["name"]
            away = f["awayTeam"]["name"]
            utc = f.get("utcDate", "")
            date = utc[:10] if utc else f.get("date", "")
        except (KeyError, TypeError):
            continue
        if not date:
            continue
        rows.append({"home": home, "away": away, "date": date})
    if not rows:
        return []
    # matchweek window: earliest fixture + N days
    earliest = min(r["date"] for r in rows)
    ed = dt.date.fromisoformat(earliest)
    cutoff = ed + dt.timedelta(days=days)
    rows = [r for r in rows if dt.date.fromisoformat(r["date"]) <= cutoff]
    # attach predictions (real only)
    out = []
    for r in rows:
        p = get_prediction(r["home"], r["away"], r["date"], league, token)
        if p is None:
            continue  # drop insufficient_data / unresolved — never fake it
        out.append({**r, "pred": p})
    return out

# ----------------------------------------------------------------------------
# Pick label + colour
# ----------------------------------------------------------------------------
def pick_line(p):
    res = p.get("predicted_result")
    h = p.get("home_win_prob_pct", 0)
    d = p.get("draw_prob_pct", 0)
    a = p.get("away_win_prob_pct", 0)
    if res == "H":
        return p["home_team"], h, HOME_C
    if res == "A":
        return p["away_team"], a, AWAY_C
    return "Draw", d, DRAW_C

# ----------------------------------------------------------------------------
# Render one league graphic
# ----------------------------------------------------------------------------
def render(league, league_name, games, outdir):
    img = Image.new("RGB", (W, H), BG)
    dr = ImageDraw.Draw(img)

    f_brand = load_font(34, bold=True)
    f_title = load_font(54, bold=True)
    f_sub = load_font(26)
    f_team = load_font(34, bold=True)
    f_pct = load_font(30, bold=True)
    f_foot = load_font(22)

    # header — purple slash + wordmark
    dr.rectangle([0, 0, W, 140], fill=PANEL)
    dr.rectangle([60, 46, 74, 96], fill=PURPLE)  # slash mark
    dr.text((92, 48), "TEHUTI.AI", font=f_brand, fill=INK)
    dr.text((92, 92), "Model predictions · before kickoff", font=ImageFont.truetype(
        f_sub.path, 20) if hasattr(f_sub, "path") else f_sub, fill=INK2)

    # league title
    dr.text((60, 180), league_name, font=f_title, fill=INK)
    dr.text((60, 246), "This matchday", font=f_sub, fill=PURPLE)

    # match rows
    y = 320
    row_h = min(120, int((H - 460) / max(len(games), 1)))
    for g in games:
        p = g["pred"]
        who, pct, col = pick_line(p)
        home = p.get("home_team", g["home"])
        away = p.get("away_team", g["away"])

        dr.rectangle([50, y, W - 50, y + row_h - 14], fill=PANEL)
        # teams
        dr.text((74, y + 16), f"{home}  v  {away}", font=f_team, fill=INK)
        # prob bar
        bar_x, bar_y, bar_w = 74, y + row_h - 44, W - 148
        dr.rectangle([bar_x, bar_y, bar_x + bar_w, bar_y + 14], fill=BAR_BG)
        fillw = int(bar_w * min(max(pct, 0), 100) / 100)
        dr.rectangle([bar_x, bar_y, bar_x + fillw, bar_y + 14], fill=col)
        # call
        call = f"Model calls: {who} {pct:.0f}%"
        dr.text((W - 50 - dr.textlength(call, font=f_pct), y + 14),
                call, font=f_pct, fill=col)
        y += row_h

    # footer
    dr.text((60, H - 96), "Predicted before kickoff · every call on the record",
            font=f_foot, fill=INK2)
    dr.text((60, H - 62), "tehuti.net", font=f_foot, fill=PURPLE)

    os.makedirs(outdir, exist_ok=True)
    date_tag = games[0]["date"] if games else dt.date.today().isoformat()
    path = os.path.join(outdir, f"{league}_{date_tag}.png")
    img.save(path)
    return path

# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
LEAGUE_NAMES = {
    "PL": "Premier League", "PD": "La Liga", "SA": "Serie A",
    "BL1": "Bundesliga", "FL1": "Ligue 1", "DED": "Eredivisie",
    "PPL": "Primeira Liga", "ELC": "Championship",
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--leagues", nargs="*", default=ALL_LEAGUES)
    ap.add_argument("--days", type=int, default=4)
    ap.add_argument("--yes", action="store_true", help="skip the review pause")
    ap.add_argument("--outdir", default="graphics")
    args = ap.parse_args()

    token = login()
    print(f"Logged in. Pulling fixtures for: {', '.join(args.leagues)}\n")

    plan = {}
    for lg in args.leagues:
        try:
            games = collect(lg, token, args.days)
        except Exception as e:
            print(f"  {lg}: error ({e}) — skipping")
            continue
        if games:
            plan[lg] = games

    if not plan:
        sys.exit("No renderable fixtures with real predictions this week.")

    # ---- REVIEW: print everything before drawing a single pixel ----
    print("=" * 64)
    print("REVIEW — these are the fixtures + real picks about to be rendered.")
    print("Check for any fixture that looks wrong (game that isn't scheduled,")
    print("home/away reversed). Nothing is posted yet.")
    print("=" * 64)
    for lg, games in plan.items():
        print(f"\n{lg} ({LEAGUE_NAMES.get(lg, lg)}) — {len(games)} matches")
        for g in games:
            who, pct, _ = pick_line(g["pred"])
            print(f"    {g['date']}  {g['pred'].get('home_team')} v "
                  f"{g['pred'].get('away_team')}  ->  {who} {pct:.0f}%")
    print("\n" + "=" * 64)

    if not args.yes:
        ans = input("Render these graphics? [y/N] ").strip().lower()
        if ans != "y":
            sys.exit("Aborted — nothing rendered.")

    print()
    for lg, games in plan.items():
        path = render(lg, LEAGUE_NAMES.get(lg, lg), games, args.outdir)
        print(f"  rendered {path}")
    print("\nDone. Files are in ./" + args.outdir)


if __name__ == "__main__":
    main()
