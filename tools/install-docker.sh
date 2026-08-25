#!/usr/bin/env bash
set -eu

# Install beside the command that invoked this script by default. Set KF_DIR
# when an explicit installation directory is preferred.
install_dir="${KF_DIR:-$PWD}"
image="${KF_IMAGE:-ghcr.io/banard2049-cpu/kf-assistant:latest}"
compose_url="${KF_COMPOSE_URL:-https://raw.githubusercontent.com/banard2049-cpu/kf-assistant/main/KF_Unified_Assistant/tools/packaging/docker/compose.yaml}"

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 Docker，请先安装 Docker Engine 或 Docker Desktop。" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "未找到 Docker Compose，请安装带 Compose 的 Docker 版本。" >&2
  exit 1
fi

mkdir -p "$install_dir/data" "$install_dir/backups"
curl -fsSL "$compose_url" -o "$install_dir/compose.yaml"

cd "$install_dir"
docker pull "$image"
# Recreate the container so environment defaults (including registration)
# are applied even when an older container already exists.
ALLOW_REGISTRATION=true KF_IMAGE="$image" docker compose up -d --force-recreate

echo "KF 助手已启动：http://服务器IP:8789/"
echo "部署目录：$install_dir"
echo "更新：cd \"$install_dir\" && docker compose pull && ALLOW_REGISTRATION=true docker compose up -d --force-recreate"
