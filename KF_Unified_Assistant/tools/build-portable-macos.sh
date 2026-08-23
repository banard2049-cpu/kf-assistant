#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PACKAGE_NAME="KF_Unified_Assistant_Portable_macOS"
OUTPUT_PATH="${1:-$(dirname "$REPO_ROOT")/${PACKAGE_NAME}_$(date +%F).tar.gz}"
OUTPUT_PATH="$(cd -- "$(dirname "$OUTPUT_PATH")" && pwd)/$(basename "$OUTPUT_PATH")"

PHP_BIN="${PHP_BIN:-$(command -v php || true)}"
if [[ -z "$PHP_BIN" || ! -x "$PHP_BIN" ]]; then
  echo "PHP 8.2+ not found. Install it with Homebrew: brew install php" >&2
  exit 1
fi
PHP_VERSION="$($PHP_BIN -r 'echo PHP_VERSION;')"
if ! "$PHP_BIN" -r "exit(version_compare(PHP_VERSION, '8.2.0', '>=') ? 0 : 1);"; then
  echo "PHP 8.2+ is required (found $PHP_VERSION)." >&2
  exit 1
fi
for extension in pdo_sqlite sqlite3 mbstring; do
  "$PHP_BIN" -r "exit(extension_loaded('$extension') ? 0 : 1);" || {
    echo "PHP extension '$extension' is required." >&2
    exit 1
  }
done

STAGE_PARENT="$(mktemp -d "${TMPDIR:-/tmp}/kf-portable-macos.XXXXXX")"
STAGE_ROOT="$STAGE_PARENT/$PACKAGE_NAME"
cleanup(){ rm -rf "$STAGE_PARENT"; }
trap cleanup EXIT
mkdir -p "$STAGE_ROOT/runtime/php"

for entry in public tools .env.example start-macos.sh start-macos.command README.md Dockerfile compose.yaml; do
  [[ -e "$REPO_ROOT/$entry" ]] && cp -R "$REPO_ROOT/$entry" "$STAGE_ROOT/"
done
chmod +x "$STAGE_ROOT/start-macos.sh" "$STAGE_ROOT/start-macos.command"

# Copy the PHP installation when its prefix is discoverable (Homebrew/setup-php).
PHP_PREFIX="$("$PHP_BIN" -r 'echo defined("PHP_PREFIX") ? PHP_PREFIX : "";' 2>/dev/null || true)"
if [[ -z "$PHP_PREFIX" ]] && command -v php-config >/dev/null 2>&1; then
  PHP_PREFIX="$(php-config --prefix 2>/dev/null || true)"
fi
if [[ -z "$PHP_PREFIX" ]] && command -v brew >/dev/null 2>&1; then
  PHP_PREFIX="$(brew --prefix php 2>/dev/null || true)"
fi
if [[ -z "$PHP_PREFIX" || ! -d "$PHP_PREFIX" ]]; then
  echo "Unable to locate the PHP installation prefix; refusing to create a non-portable package." >&2
  exit 1
fi
cp -R "$PHP_PREFIX"/* "$STAGE_ROOT/runtime/php/"

cat > "$STAGE_ROOT/PORTABLE-README.txt" <<EOF
KF Unified Assistant macOS package
PHP: $PHP_VERSION
Architecture: $(uname -m)

Run ./start-macos.command (or ./start-macos.sh).
The package includes the PHP runtime when the build environment exposes its installation prefix.
EOF

rm -f "$OUTPUT_PATH" "$OUTPUT_PATH.sha256.txt"
mkdir -p "$(dirname "$OUTPUT_PATH")"
tar -czf "$OUTPUT_PATH" -C "$STAGE_PARENT" "$PACKAGE_NAME"
HASH="$(shasum -a 256 "$OUTPUT_PATH" | awk '{print $1}')"
printf '%s  %s\n' "$HASH" "$(basename "$OUTPUT_PATH")" > "$OUTPUT_PATH.sha256.txt"
echo "Portable macOS package: $OUTPUT_PATH"
echo "SHA256: $HASH"
