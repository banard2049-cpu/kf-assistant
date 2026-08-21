#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker was not found. Install Docker Desktop, then run this script again."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is unavailable. Install Docker Desktop with Compose support."
  exit 1
fi

if [[ $# -eq 0 ]]; then
  docker compose up -d --build
  echo "KF Unified Campaign Assistant: http://127.0.0.1:8789"
  open "http://127.0.0.1:8789" 2>/dev/null || true
else
  docker compose "$@"
fi
