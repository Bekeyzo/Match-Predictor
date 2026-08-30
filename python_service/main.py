import asyncio
from datetime import datetime, date
from contextlib import asynccontextmanager

import aio_pika
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from predictor import (
    download_league_data,
    load_league_data,
    train_model,
    predict_fixture,
    build_name_index,
    get_h2h_from_data,
    get_h2h_at_venue,
    resolve_team,
    save_model,
    load_saved_model,
    LEAGUE_FILES,
)

# ─────────────────────────────────────────────
# IN-MEMORY MODEL CACHE
# Instead of retraining the model on every prediction request
# (which would take seconds), we train once per league on startup
# and keep the trained model in memory.
# Structure: { "PL": (model, label_encoder, dataframe), ... }
# ─────────────────────────────────────────────
model_cache: dict = {}

def load_and_train(league_code: str, force_retrain: bool = False):
    """Load a league's model — from disk if saved, training fresh otherwise."""
    print(f"Loading {league_code}...")
    try:
        saved = None if force_retrain else load_saved_model(league_code)

        if saved is not None:
            # FAST PATH — model already on disk, just load data from local CSVs
            try:
                all_data = load_league_data(league_code)
            except ValueError:
                # CSVs missing locally — download once, then load
                download_league_data(league_code)
                all_data = load_league_data(league_code)
            model, le, stats = saved
            print(f"⚡ Loaded saved model for {league_code}")
        else:
            # SLOW PATH — fresh download, train, persist for next time
            download_league_data(league_code)
            all_data = load_league_data(league_code)
            model, le, stats = train_model(all_data)
            save_model(league_code, model, le, stats)
            print(f"✅ Trained and saved model for {league_code}")

        name_index = build_name_index(all_data)
        model_cache[league_code] = (model, le, all_data, name_index, stats)
    except Exception as e:
        print(f"❌ Failed to load {league_code}: {e}")

def retrain_all_leagues():
    """Refresh data + retrain every league. Runs on the twice-weekly schedule."""
    print("🔄 Scheduled retrain starting for all leagues...")
    for league_code in LEAGUE_FILES.keys():
        load_and_train(league_code, force_retrain=True)
    print("✅ Scheduled retrain complete")


def grade_all_leagues():
    """Grade every league's finished-but-ungraded predictions. Runs daily so a
    match played yesterday shows its result the next morning. Calls the public
    /grade endpoint (same path proven to work manually)."""
    import requests as _rq
    API = "https://api.tehuti.net"
    print("🏁 Scheduled grading starting for all leagues...")
    try:
        r = _rq.post(f"{API}/login",
                     json={"email": "gfx2@example.com", "password": "testpass99"},
                     timeout=30)
        token = r.json().get("token")
        if not token:
            print("⚠️  Grading skipped — could not log in")
            return
    except Exception as e:
        print(f"⚠️  Grading login failed: {e}")
        return
    headers = {"Authorization": f"Bearer {token}"}
    for lg in LEAGUE_FILES.keys():
        try:
            g = _rq.post(f"{API}/grade?league={lg}", headers=headers, timeout=60)
            print(f"   {lg}: {g.text.strip()}")
        except Exception as e:
            print(f"   {lg}: grade failed ({e})")
    print("✅ Scheduled grading complete")

# ─────────────────────────────────────────────
# STARTUP AND SHUTDOWN
# FastAPI lifespan runs code when the server starts and stops
# On startup: download data and train models for all leagues
# On shutdown: clean up connections
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP — runs when FastAPI server starts
    print("🚀 Starting Python ML service...")

    # Train a model for every league we support
    for league_code in LEAGUE_FILES.keys():
        # Run in a thread so we don't block the async event loop
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, load_and_train, league_code)

    # Start listening to RabbitMQ for retrain requests
    asyncio.create_task(listen_for_retrain())

    # Auto-update scheduler — retrains all leagues Mon & Thu at 08:00.
    # Cadence matches when fresh results land (weekend + midweek rounds);
    # avoids hammering football-data.co.uk, which risks rate-limiting/blocking.
    scheduler = AsyncIOScheduler(timezone="Africa/Lagos")
    scheduler.add_job(
        retrain_all_leagues,
        trigger="cron",
        day_of_week="mon,thu",
        hour=8,
        minute=0,
    )
    scheduler.add_job(
        grade_all_leagues,
        trigger="cron",
        hour=6,
        minute=0,
    )
    scheduler.start()
    print("📅 Auto-update scheduler started (retrain Mon & Thu 08:00, grading daily 06:00)")
    
    print("✅ ML service ready")
    yield
    # SHUTDOWN — runs when server stops
    print("Shutting down ML service...")


# Create the FastAPI app
app = FastAPI(
    title="Match Predictor ML Service",
    lifespan=lifespan
)


# ─────────────────────────────────────────────
# REQUEST/RESPONSE MODELS
# Pydantic models define exactly what shape of data
# the API accepts and returns — FastAPI validates
# all incoming requests against these automatically
# ─────────────────────────────────────────────
class PredictionRequest(BaseModel):
    home_team: str
    away_team: str
    match_date: date
    league_code: str


class H2HRequest(BaseModel):
    home_team: str
    away_team: str
    league_code: str


class RetrainRequest(BaseModel):
    league_code: str


# ─────────────────────────────────────────────
# HEALTH CHECK
# Go service calls this to verify Python service is alive
# ─────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "loaded_leagues": list(model_cache.keys())
    }


# ─────────────────────────────────────────────
# PREDICTION ENDPOINT
# Go service calls this with a fixture and gets back
# the full prediction — win probs, goals, score, corners, cards
# ─────────────────────────────────────────────
@app.post("/predict")
def predict(req: PredictionRequest):
    # Check if we have a trained model for this league
    if req.league_code not in model_cache:
        raise HTTPException(
            status_code=404,
            detail=f"No model loaded for league: {req.league_code}"
        )

    model, le, all_data, name_index, _stats = model_cache[req.league_code]

    try:
        # Convert date to pandas Timestamp for comparison with DataFrame dates
        target_date = datetime.combine(req.match_date, datetime.min.time())

        result = predict_fixture(
            home_team=req.home_team,
            away_team=req.away_team,
            target_date=target_date,
            all_data=all_data,
            model=model,
            le=le,
            name_index=name_index,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/h2h")
def h2h(req: H2HRequest):
    if req.league_code not in model_cache:
        raise HTTPException(status_code=404, detail=f"No model loaded for league: {req.league_code}")
    _model, _le, all_data, name_index, _stats = model_cache[req.league_code]
    try:
        return {
            "meetings": get_h2h_from_data(req.home_team, req.away_team, all_data, name_index),
            "home_venue": get_h2h_at_venue(req.home_team, req.away_team, all_data, name_index),
            "away_venue": get_h2h_at_venue(req.away_team, req.home_team, all_data, name_index),
            "home_team": resolve_team(req.home_team, name_index),
            "away_team": resolve_team(req.away_team, name_index),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# RETRAIN ENDPOINT
# Called manually or triggered by RabbitMQ after a matchday ends
# Downloads fresh data and retrains the model for a specific league
# ─────────────────────────────────────────────
@app.get("/accuracy")
def accuracy():
    """How often the model was right on matches it never trained on."""
    leagues = []
    tot_correct = tot_tested = base_correct = 0

    # Only report leagues the app actually serves
    SERVED = {"PL","ELC","PD","PD2","BL1","BL2","SA","SB",
              "FL1","FL2","DED","PPL","BEL","GSL"}

    for code, entry in model_cache.items():
        if code not in SERVED:
            continue
        stats = entry[4] if len(entry) > 4 else None
        if not stats:
            continue
        leagues.append({"league": code, **stats})
        tot_tested += stats["tested"]
        tot_correct += stats["accuracy"] / 100 * stats["tested"]
        base_correct += stats["baseline"] / 100 * stats["tested"]

    leagues.sort(key=lambda x: x["accuracy"], reverse=True)

    return {
        "overall": round(tot_correct / tot_tested * 100, 1) if tot_tested else 0,
        "baseline": round(base_correct / tot_tested * 100, 1) if tot_tested else 0,
        "tested": tot_tested,
        "leagues": leagues,
    }


@app.post("/retrain")
def retrain(req: RetrainRequest, background_tasks: BackgroundTasks):
    if req.league_code not in LEAGUE_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown league code: {req.league_code}"
        )

    # Run retraining in the background so the API responds immediately
    # The client doesn't have to wait for training to finish
    background_tasks.add_task(load_and_train, req.league_code, True)  # force_retrain=True

    return {
        "status": "retraining started",
        "league_code": req.league_code
    }


# ─────────────────────────────────────────────
# RABBITMQ CONSUMER
# Listens for retrain messages from Go service
# When a matchday ends, Go publishes a message like:
# {"league_code": "PL"}
# This consumer picks it up and retrains the model
# ─────────────────────────────────────────────
async def listen_for_retrain():
    import os
    rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

    try:
        # Connect to RabbitMQ
        connection = await aio_pika.connect_robust(rabbitmq_url)
        channel = await connection.channel()

        # Declare the queue we'll listen on
        queue = await channel.declare_queue("retrain_queue", durable=True)

        print("👂 Listening for retrain messages on RabbitMQ...")

        # Process each message as it arrives
        async for message in queue:
            async with message.process():
                import json
                try:
                    body = json.loads(message.body.decode())
                    league_code = body.get("league_code")
                    if league_code:
                        print(f"📨 Retrain message received for {league_code}")
                        # Run in executor so async loop isn't blocked
                        loop = asyncio.get_event_loop()
                        await loop.run_in_executor(None, load_and_train, league_code, True)
                except Exception as e:
                    print(f"Error processing retrain message: {e}")

    except Exception as e:
        # RabbitMQ might not be running yet during development
        print(f"RabbitMQ not available: {e} — retrain via HTTP only")