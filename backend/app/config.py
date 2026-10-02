import os

from dotenv import load_dotenv


# Load backend/.env for local development. In production the platform
# (Railway / Render) injects real environment variables instead.
load_dotenv()


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://gnani:gnani@localhost:5432/audio_notes",
)

# Railway/Heroku style URLs use "postgres://", which SQLAlchemy rejects.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

GNANI_API_KEY = os.getenv("GNANI_API_KEY", "")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

# Storage: if S3_BUCKET is set we use an S3-compatible bucket
# (Railway Buckets, Cloudflare R2, AWS S3...). Otherwise files go to
# the local ./storage folder, which is only meant for development.
S3_BUCKET = os.getenv("S3_BUCKET", "")
S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL") or None
S3_REGION = os.getenv("S3_REGION", "auto")
S3_ACCESS_KEY_ID = os.getenv("S3_ACCESS_KEY_ID", "")
S3_SECRET_ACCESS_KEY = os.getenv("S3_SECRET_ACCESS_KEY", "")
LOCAL_STORAGE_DIR = os.getenv("LOCAL_STORAGE_DIR", "storage")

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "500"))

# Auth. JWT_SECRET signs login tokens: anyone who knows it can forge a
# token for any user, so production must set a long random value.
JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-insecure-secret-change-me")
JWT_EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "7"))

# Uploads allowed on the free plan before the user has to upgrade.
FREE_UPLOAD_LIMIT = int(os.getenv("FREE_UPLOAD_LIMIT", "10"))

# Comma separated list of frontend origins allowed to call the API.
# Browsers send the Origin without a trailing slash, so strip any here;
# "https://x.vercel.app/" would otherwise never match.
CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
