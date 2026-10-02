FROM python:3.11-slim

# ffmpeg/ffprobe are needed by both the API (quick validation) and the
# worker (conversion + chunking).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Same image runs as two services. Default is the API; the worker
# service overrides the start command with:
#   celery -A app.worker.celery_app worker --loglevel=info --concurrency=2
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
