#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PHP_BIN="${PHP_BIN:-}"
if [[ -z "$PHP_BIN" && -x "$SCRIPT_DIR/runtime/php/bin/php" ]]; then
  PHP_BIN="$SCRIPT_DIR/runtime/php/bin/php"
elif [[ -z "$PHP_BIN" && -x "$SCRIPT_DIR/runtime/php/php" ]]; then
  PHP_BIN="$SCRIPT_DIR/runtime/php/php"
elif [[ -z "$PHP_BIN" ]]; then
  PHP_BIN="$(command -v php || true)"
fi

if [[ -z "$PHP_BIN" || ! -x "$PHP_BIN" ]]; then
  echo "PHP 8.2 or newer was not found. Install PHP with Homebrew: brew install php"
  exit 1
fi

PHP_VERSION="$($PHP_BIN -r 'echo PHP_VERSION;')"
if ! "$PHP_BIN" -r "exit(version_compare(PHP_VERSION, '8.2.0', '>=') ? 0 : 1);"; then
  echo "PHP 8.2 or newer is required (found $PHP_VERSION)."
  exit 1
fi

for extension in pdo_sqlite sqlite3; do
  if ! "$PHP_BIN" -r "exit(extension_loaded('$extension') ? 0 : 1);"; then
    echo "PHP extension '$extension' is required."
    exit 1
  fi
done

[[ -f .env ]] || cp .env.example .env
mkdir -p data backups logs

echo "KF Unified Campaign Assistant"
echo "Local: http://127.0.0.1:8789"
open "http://127.0.0.1:8789" 2>/dev/null || true

exec "$PHP_BIN" -S 0.0.0.0:8789 -t public
