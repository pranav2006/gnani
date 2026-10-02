from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.database import Base, engine
from app.api.uploads import router as uploads_router


# Creates tables that don't exist yet. Fine for a small project; with
# schema changes over time this should become Alembic migrations.
Base.metadata.create_all(bind=engine)

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
