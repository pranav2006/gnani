# Audio Notes (Gnani take-home)

Upload an audio file → transcript (Gnani Batch STT) + summary (Groq LLM).
Next.js frontend, FastAPI backend, Postgres, Redis + Celery worker, S3-compatible bucket.
See the in-app `/architecture` page for the design write-up.

```
backend/   FastAPI app (app/api), Celery worker (app/worker), services (gnani, audio, storage, summary)
frontend/  Next.js app: / (upload + history), /uploads/[id], /architecture
```

## Run locally

Requires Docker, Python 3.10+, Node 20+, and ffmpeg on PATH.

Quick way (Git Bash on Windows, or any bash): `./start.sh` starts everything and `./stop.sh` stops it
(`./stop.sh --all` also stops Postgres/Redis). Logs are in `.run/logs/`.

Or step by step:

```bash
docker compose up -d                      # Postgres + Redis

cd backend
cp .env.example .env                      # fill GNANI_API_KEY and GROQ_API_KEY
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# second terminal (--pool=solo is needed on Windows):
celery -A app.worker.celery_app worker --loglevel=info --pool=solo

cd frontend
npm install
npm run dev                               # http://localhost:3000
```

## Deploy

Everything runs in the cloud: Railway hosts the API, worker, Postgres, Redis and the bucket; Vercel hosts the frontend.

**Backend on Railway** (one project):
1. Add **Postgres**, **Redis** and a **Bucket** (Create → Database / Bucket).
2. Add a service from this GitHub repo, root directory `backend` (Railway builds the `Dockerfile`). Name it `api`
   and generate a public domain for it under Settings → Networking.
3. Add a second service from the same repo and root, named `worker`, with the custom start command
   `celery -A app.worker.celery_app worker --loglevel=info --concurrency=2`. It needs no public domain.
4. Set these variables on **both** services (the `${{...}}` references are filled in by Railway; the service names
   must match yours):

   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   GNANI_API_KEY=...
   GROQ_API_KEY=...
   S3_BUCKET=${{Bucket.BUCKET}}
   S3_ENDPOINT_URL=${{Bucket.ENDPOINT}}
   S3_REGION=${{Bucket.REGION}}
   S3_ACCESS_KEY_ID=${{Bucket.ACCESS_KEY_ID}}
   S3_SECRET_ACCESS_KEY=${{Bucket.SECRET_ACCESS_KEY}}
   ```

   And on `api` only: `CORS_ORIGINS=https://<your-app>.vercel.app`.

**Frontend on Vercel**: import the repo with root directory `frontend`, and set
`NEXT_PUBLIC_API_URL=https://<api-domain>.up.railway.app` and `NEXT_PUBLIC_GITHUB_URL=<this repo>`.
These are baked in at build time, so redeploy after changing them.
