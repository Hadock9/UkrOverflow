#!/usr/bin/env bash
# Перевірка GitHub OAuth на VPS (потрібен робочий SSH).
# Використання:
#   bash scripts/check-vps-github-oauth.sh
#   bash scripts/check-vps-github-oauth.sh root@93.115.22.26 /opt/ukroverflow

set -euo pipefail

SSH_TARGET="${1:-root@93.115.22.26}"
REMOTE_DIR="${2:-/opt/ukroverflow}"

ssh -o ConnectTimeout=15 "${SSH_TARGET}" bash -s <<REMOTE
set -euo pipefail
cd "${REMOTE_DIR}"
echo "=== docker compose ps ==="
docker compose ps 2>/dev/null || docker compose --env-file .env ps

echo ""
echo "=== OAuth-related .env (секрет не показуємо) ==="
grep -E '^FRONTEND_URL=|^GITHUB_CALLBACK_URL=|^GITHUB_OAUTH_REDIRECT_URI=|^GITHUB_OAUTH_PUBLIC_ORIGIN=|^VITE_FRONTEND_CANONICAL_ORIGIN=|^GITHUB_CLIENT_ID=|^NODE_ENV=' .env || true
if grep -q '^GITHUB_CLIENT_SECRET=.' .env 2>/dev/null; then
  echo "GITHUB_CLIENT_SECRET: задано"
else
  echo "GITHUB_CLIENT_SECRET: відсутнє або порожнє"
fi

echo ""
echo "=== api logs: GitHub OAuth ==="
docker compose logs api --tail 150 2>/dev/null | grep -F 'GitHub OAuth' | tail -12 || true

echo ""
echo "=== Location для /api/auth/github (nginx → api, Host devflow.info) ==="
curl -sSI --max-redirs 0 -H 'Host: devflow.info' 'http://127.0.0.1/api/auth/github' 2>&1 | grep -i '^location:' || echo '(немає Location — перевір nginx/api)'

echo ""
echo "=== /api/auth/github/status (Host devflow.info) ==="
curl -sk -H 'Host: devflow.info' 'http://127.0.0.1/api/auth/github/status' || true

echo ""
echo "=== /api/auth/github/resolved-callback (Host devflow.info) ==="
curl -sk -H 'Host: devflow.info' 'http://127.0.0.1/api/auth/github/resolved-callback' || true

echo ""
echo "=== Публічний resolved-callback через HTTPS ==="
curl -sk 'https://devflow.info/api/auth/github/resolved-callback' || true
REMOTE
