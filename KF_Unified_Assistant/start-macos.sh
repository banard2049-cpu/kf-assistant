#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v php >/dev/null 2>&1; then
  echo "PHP 8.2 or newer was not found. Install PHP with Homebrew: brew install php"
  exit 1
fi

PHP_VERSION="$(php -r 'echo PHP_VERSION;')"
if ! php -r "exit(version_compare(PHP_VERSION, '8.2.0', '>=') ? 0 : 1);"; then
  echo "PHP 8.2 or newer is required (found $PHP_VERSION)."
  exit 1
fi

for extension in pdo_sqlite sqlite3; do
  if ! php -r "exit(extension_loaded('$extension') ? 0 : 1);"; then
    echo "PHP extension '$extension' is required."
    exit 1
  fi
done

[[ -f .env ]] || cp .env.example .env
mkdir -p data backups logs

echo "KF Unified Campaign Assistant"
echo "Local: http://127.0.0.1:8789"
open "http://127.0.0.1:8789" 2>/dev/null || true

exec php -S 0.0.0.0:8789 -t public
