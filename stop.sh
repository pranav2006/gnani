#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_DIR="$ROOT/.run/pids"

is_windows() {
  case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) return 0 ;; *) return 1 ;; esac
}

# kills child processes too
kill_tree() {
  local pid="$1"
  if is_windows; then
    local winpid
    winpid="$(cat "/proc/$pid/winpid" 2>/dev/null)" || return 1
    taskkill //PID "$winpid" //T //F >/dev/null 2>&1
  else
    pkill -TERM -P "$pid" 2>/dev/null
    kill -TERM "$pid" 2>/dev/null
  fi
}

for name in frontend worker api; do
  pid_file="$PID_DIR/$name.pid"
  [[ -f "$pid_file" ]] || continue

  pid="$(cat "$pid_file")"
  if kill -0 "$pid" 2>/dev/null && kill_tree "$pid"; then
    echo "Stopped $name (pid $pid)"
  else
    echo "$name was not running"
  fi
  rm -f "$pid_file"
done

if [[ "${1:-}" == "--all" ]]; then
  echo "Stopping Postgres and Redis..."
  docker compose -f "$ROOT/docker-compose.yaml" stop
fi
