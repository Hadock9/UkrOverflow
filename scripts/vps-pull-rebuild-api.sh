#!/usr/bin/env bash
# Оновлення коду та перебір контейнера api на VPS (потрібен SSH).
# З ноутбука:
#   bash scripts/vps-pull-rebuild-api.sh
#   SSH_TARGET=user@host REMOTE_DIR=/opt/ukroverflow bash scripts/vps-pull-rebuild-api.sh

set -euo pipefail

SSH_TARGET="${SSH_TARGET:-root@93.115.22.26}"
REMOTE_DIR="${REMOTE_DIR:-/opt/ukroverflow}"

exec ssh -o ConnectTimeout=20 "${SSH_TARGET}" bash -s <<REMOTE
set -euo pipefail
cd "${REMOTE_DIR}"
git pull origin main
docker compose --env-file .env up -d --build api
echo "✓ Готово: api перебудовано"
REMOTE
