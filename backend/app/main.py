from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import CORS_ORIGINS
from app.database import Base, engine
from app.api.auth import router as auth_router
from app.api.uploads import router as uploads_router


# Creates tables that don't exist yet. Fine for a small project; with
# schema changes over time this should become Alembic migrations.
Base.metadata.create_all(bind=engine)

# create_all never alters existing tables, so the column added with user
# accounts has to be added by hand on databases created before it.
# IF NOT EXISTS makes this safe to run on every start.
with engine.begin() as connection:
    connection.execute(text(
        "ALTER TABLE audio_uploads "
        "ADD COLUMN IF NOT EXISTS user_id UUID "
        "REFERENCES users(id) ON DELETE CASCADE"
    ))
    connection.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_audio_uploads_user_id "
        "ON audio_uploads (user_id)"
    ))

app = FastAPI(
    title="Gnani Audio Notes API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    auth_router
)

app.include_router(
    uploads_router
)


@app.get("/")
def root():
    return {
        "message": "Gnani Audio Notes API is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }
