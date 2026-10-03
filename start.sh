#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
RUN_DIR="$ROOT/.run"
LOG_DIR="$RUN_DIR/logs"
PID_DIR="$RUN_DIR/pids"
mkdir -p "$LOG_DIR" "$PID_DIR"

PYTHON="${PYTHON:-python}"

is_windows() {
  case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) return 0 ;; *) return 1 ;; esac
}

is_running() {
  local pid_file="$PID_DIR/$1.pid"
  [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

start_service() {
  local name="$1" dir="$2"
  shift 2

  if is_running "$name"; then
    echo "  $name already running (pid $(cat "$PID_DIR/$name.pid"))"
    return
  fi

  (cd "$dir" && exec "$@") >"$LOG_DIR/$name.log" 2>&1 &
  echo $! >"$PID_DIR/$name.pid"
  echo "  $name started (log: .run/logs/$name.log)"
}

wait_for() {
  local what="$1" seconds="$2"
  shift 2
  for _ in $(seq 1 "$seconds"); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "ERROR: $what did not become ready within ${seconds}s" >&2
  return 1
}

echo "Checking prerequisites..."
for tool in docker ffmpeg ffprobe npm "$PYTHON"; do
  command -v "$tool" >/dev/null || { echo "ERROR: '$tool' not found on PATH" >&2; exit 1; }
done
docker info >/dev/null 2>&1 || { echo "ERROR: Docker is not running (or is paused). Start Docker Desktop first." >&2; exit 1; }
[[ -f "$ROOT/backend/.env" ]] || { echo "ERROR: backend/.env missing. Copy backend/.env.example and fill in the keys." >&2; exit 1; }

echo "Starting Postgres and Redis..."
docker compose -f "$ROOT/docker-compose.yaml" up -d
wait_for "Postgres" 60 docker exec gnani-postgres pg_isready -U gnani -d audio_notes
wait_for "Redis" 30 docker exec gnani-redis redis-cli ping

if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
  echo "Installing frontend dependencies (first run)..."
  (cd "$ROOT/frontend" && npm install)
fi

# Windows needs solo pool
CELERY_POOL=()
if is_windows; then CELERY_POOL=(--pool=solo); fi

echo "Starting app processes..."
start_service api "$ROOT/backend" "$PYTHON" -m uvicorn app.main:app --port 8000 --reload
start_service worker "$ROOT/backend" "$PYTHON" -m celery -A app.worker.celery_app worker --loglevel=info "${CELERY_POOL[@]}"
# not npm: pid tracking
start_service frontend "$ROOT/frontend" node node_modules/next/dist/bin/next dev

wait_for "API (see .run/logs/api.log)" 60 curl -sf http://localhost:8000/health
wait_for "frontend (see .run/logs/frontend.log)" 90 curl -sf -o /dev/null http://localhost:3000

echo
echo "All running:"
echo "  App:      http://localhost:3000"
echo "  API docs: http://localhost:8000/docs"
echo "  Follow logs: tail -f .run/logs/worker.log"
echo "  Stop:     ./stop.sh"
