#!/usr/bin/env bash
# Оновлення GitHub OAuth (і пов’язаних змінних) у .env для docker compose на VPS.
# Значення НЕ зберігаються у репозиторії — передаються лише в командному рядку / SSH-сесії.
#
# Обов’язково перед запуском встановити:
#   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
#
# Опційно (якщо задати змінну — старий рядок із .env буде замінено):
#   FRONTEND_URL
#   GITHUB_CALLBACK_URL, GITHUB_OAUTH_REDIRECT_URI  (за замовчуванням дорівнюють {FRONTEND_URL}/api/auth/github/callback, якщо заданий FRONTEND_URL)
#   VITE_FRONTEND_CANONICAL_ORIGIN  (для збірки web: редірект після логіну на HTTPS-домен)
#
# Використання на сервері (у каталозі з docker-compose.yml і .env):
#
#   GITHUB_CLIENT_ID=Ov23ctQ1xVSsfKrHZMS5 \
#   GITHUB_CLIENT_SECRET='ВАШ_НОВИЙ_SECRET' \
#   FRONTEND_URL=https://devflow.info \
#   ./scripts/set-docker-env-github.sh
#
# Або явно вписати callback (байт у байт як у GitHub OAuth App):
#
#   GITHUB_CLIENT_ID=... GITHUB_CLIENT_SECRET='...' \
#   FRONTEND_URL=https://devflow.info \
#   GITHUB_CALLBACK_URL=https://devflow.info/api/auth/github/callback \
#   GITHUB_OAUTH_REDIRECT_URI=https://devflow.info/api/auth/github/callback \
#   VITE_FRONTEND_CANONICAL_ORIGIN=https://devflow.info \
#   ./scripts/set-docker-env-github.sh
#
# Потім перезапустити сервіси (секрети читає API з .env без перезбірки образу api):
#   docker compose --env-file .env up -d
# Якщо змінювали VITE_* — потрібна перебудова web:
#   docker compose --env-file .env up -d --build web

set -euo pipefail

ENV_FILE="${1:-.env}"

if [[ -z "${GITHUB_CLIENT_ID:-}" || -z "${GITHUB_CLIENT_SECRET:-}" ]]; then
  echo "Помилка: задайте GITHUB_CLIENT_ID та GITHUB_CLIENT_SECRET (експортом перед викликом)." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Створюю $ENV_FILE"
  touch "$ENV_FILE"
fi

CALLBACK="${GITHUB_CALLBACK_URL:-}"
REDIRECT_URI="${GITHUB_OAUTH_REDIRECT_URI:-}"
FRONT="${FRONTEND_URL:-}"

if [[ -n "$FRONT" && -z "$CALLBACK" ]]; then
  CALLBACK="${FRONT%/}/api/auth/github/callback"
fi
if [[ -n "$FRONT" && -z "$REDIRECT_URI" ]]; then
  REDIRECT_URI="$CALLBACK"
fi
if [[ -n "$CALLBACK" && -z "$REDIRECT_URI" ]]; then
  REDIRECT_URI="$CALLBACK"
fi

bak="${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
cp "$ENV_FILE" "$bak"
echo "Резервна копія: $bak"

should_skip_line() {
  local line="$1"
  [[ "$line" =~ ^GITHUB_CLIENT_ID= ]] && return 0
  [[ "$line" =~ ^GITHUB_CLIENT_SECRET= ]] && return 0
  [[ -n "${FRONTEND_URL:-}" && "$line" =~ ^FRONTEND_URL= ]] && return 0
  [[ -n "${CALLBACK:-}" && "$line" =~ ^GITHUB_CALLBACK_URL= ]] && return 0
  [[ -n "${REDIRECT_URI:-}" && "$line" =~ ^GITHUB_OAUTH_REDIRECT_URI= ]] && return 0
  [[ -n "${VITE_FRONTEND_CANONICAL_ORIGIN:-}" && "$line" =~ ^VITE_FRONTEND_CANONICAL_ORIGIN= ]] && return 0
  return 1
}

tmp="$(mktemp)"
while IFS= read -r line || [[ -n "${line:-}" ]]; do
  if should_skip_line "$line"; then
    continue
  fi
  printf '%s\n' "$line"
done < "$ENV_FILE" >"$tmp"

{
  echo ""
  echo "### GitHub OAuth (оновлено $(date -u +%Y-%m-%dT%H:%MZ))"
  echo "GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}"
  echo "GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}"
  if [[ -n "${FRONTEND_URL:-}" ]]; then
    echo "FRONTEND_URL=${FRONTEND_URL}"
  fi
  if [[ -n "$CALLBACK" ]]; then
    echo "GITHUB_CALLBACK_URL=${CALLBACK}"
  fi
  if [[ -n "$REDIRECT_URI" ]]; then
    echo "GITHUB_OAUTH_REDIRECT_URI=${REDIRECT_URI}"
  fi
  if [[ -n "${VITE_FRONTEND_CANONICAL_ORIGIN:-}" ]]; then
    echo "VITE_FRONTEND_CANONICAL_ORIGIN=${VITE_FRONTEND_CANONICAL_ORIGIN}"
  fi
} >>"$tmp"

mv "$tmp" "$ENV_FILE"
echo "Готово: оновлено $ENV_FILE"
echo "Не показуємо вміст секрету. Перезапуск: docker compose --env-file $ENV_FILE up -d"
