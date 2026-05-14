#!/usr/bin/env bash
# Готовий wrapper для production OAuth на devflow.info.
# Використання на VPS:
#   GITHUB_CLIENT_ID=... GITHUB_CLIENT_SECRET='...' bash scripts/set-vps-devflow-oauth.sh
# Або з іншим env-файлом:
#   GITHUB_CLIENT_ID=... GITHUB_CLIENT_SECRET='...' bash scripts/set-vps-devflow-oauth.sh /path/to/.env
#
# Що ставить:
#   FRONTEND_URL=https://devflow.info
#   GITHUB_CALLBACK_URL=https://devflow.info/api/auth/github/callback
#   GITHUB_OAUTH_REDIRECT_URI=https://devflow.info/api/auth/github/callback
#   GITHUB_OAUTH_PUBLIC_ORIGIN=https://devflow.info
#   VITE_FRONTEND_CANONICAL_ORIGIN=https://devflow.info

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${1:-.env}"

if [[ -z "${GITHUB_CLIENT_ID:-}" || -z "${GITHUB_CLIENT_SECRET:-}" ]]; then
  echo "Помилка: задайте GITHUB_CLIENT_ID та GITHUB_CLIENT_SECRET перед запуском." >&2
  exit 1
fi

FRONTEND_URL="https://devflow.info" \
GITHUB_CALLBACK_URL="https://devflow.info/api/auth/github/callback" \
GITHUB_OAUTH_REDIRECT_URI="https://devflow.info/api/auth/github/callback" \
GITHUB_OAUTH_PUBLIC_ORIGIN="https://devflow.info" \
VITE_FRONTEND_CANONICAL_ORIGIN="https://devflow.info" \
bash "${SCRIPT_DIR}/set-docker-env-github.sh" "${ENV_FILE}"

echo ""
echo "Перевірка після оновлення .env:"
echo "  bash scripts/check-vps-github-oauth.sh"
echo "Потім перезапуск:"
echo "  docker compose --env-file ${ENV_FILE} up -d"
echo "  docker compose --env-file ${ENV_FILE} up -d --build web"
