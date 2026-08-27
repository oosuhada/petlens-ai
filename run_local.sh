#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -x .venv/bin/uvicorn ]]; then
  echo "Missing Python environment. Run: python3 -m venv .venv && .venv/bin/pip install -r ml_service/requirements.txt" >&2
  exit 1
fi

export NEXT_PUBLIC_PETLENS_API_URL="${NEXT_PUBLIC_PETLENS_API_URL:-http://127.0.0.1:8000}"
export HF_HUB_DISABLE_XET="${HF_HUB_DISABLE_XET:-1}"

.venv/bin/uvicorn ml_service.app:app --host 127.0.0.1 --port 8000 &
ML_PID=$!

NODE_OPTIONS=--openssl-legacy-provider npm run dev &
WEB_PID=$!

cleanup() {
  kill "$ML_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait
