"""
Data-freshness guard: never predict on stale data.
Compares each league's loaded data against football-data.co.uk's current state.
"""
import io
import json
import time
from pathlib import Path

import pandas as pd
import requests

import predictor

try:
    import redis as _redis
except ImportError:
    _redis = None

STATUS_FILE = predictor.DATA_DIR / "freshness_status.json"
_UA = {"User-Agent": "Mozilla/5.0 (compatible; TehutiBot/1.0)"}


def _source_latest(league_code):
    season = predictor.current_seasons(1)[0]
    url = predictor.DATA_URLS[league_code].format(season=season)
    r = requests.get(url, headers=_UA, timeout=15)
    if r.status_code != 200 or len(r.content) < 100:
        return None
    src = pd.read_csv(io.StringIO(r.text))
    return pd.to_datetime(src["Date"], dayfirst=True, errors="coerce").max()


def check_league(league_code):
    try:
        d = predictor.load_league_data(league_code)
        ours = pd.to_datetime(d["Date"]).max()
    except Exception as e:
        return {"league": league_code, "stale": False, "error": f"load: {e}"}
    try:
        src_latest = _source_latest(league_code)
    except Exception as e:
        return {"league": league_code, "stale": False, "error": f"source: {e}"}
    if src_latest is None or pd.isna(src_latest):
        return {"league": league_code, "stale": False, "note": "no source data"}
    stale = bool(src_latest > ours)
    return {
        "league": league_code,
        "ours": str(ours.date()),
        "source": str(src_latest.date()),
        "stale": stale,
        "gap_days": int((src_latest - ours).days),
    }


def _flush_league_cache(league_code):
    """Delete this league's cached predictions so a stale/updated league can't
    be served from Redis. Best-effort — never raises."""
    if _redis is None:
        return
    try:
        import os
        host = os.environ.get("REDIS_HOST", "redis")
        r = _redis.Redis(host=host, port=6379, decode_responses=True)
        keys = list(r.scan_iter(match=f"prediction:{league_code}:*"))
        if keys:
            r.delete(*keys)
            print(f"   flushed {len(keys)} cached predictions for {league_code}")
    except Exception as e:
        print(f"   cache flush failed for {league_code}: {e}")


def refresh_all(auto_retrain=True, retrain_fn=None):
    status = {"checked_at": int(time.time()), "leagues": {}}
    for lg in predictor.DATA_URLS.keys():
        res = check_league(lg)
        status["leagues"][lg] = res
        if res.get("stale"):
            _flush_league_cache(lg)
        if auto_retrain and res.get("stale") and retrain_fn:
            try:
                retrain_fn(lg)
                _flush_league_cache(lg)
                status["leagues"][lg] = check_league(lg)
            except Exception as e:
                status["leagues"][lg]["retrain_error"] = str(e)[:60]
    try:
        STATUS_FILE.write_text(json.dumps(status))
    except Exception:
        pass
    return status


def is_stale(league_code):
    try:
        status = json.loads(STATUS_FILE.read_text())
        return bool(status.get("leagues", {}).get(league_code, {}).get("stale"))
    except Exception:
        return False
