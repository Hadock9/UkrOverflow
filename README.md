# UkrOverflow

Українська платформа питань і відповідей (аналог Stack Overflow). Monorepo: **frontend** (React + Vite), **backend** (Node.js), **mediator** (патерн посередника для взаємодії компонентів).

## Швидкий старт

У корені репозиторію:

```bash
npm install
npm run dev
```

Окремо: `npm run dev:backend`, `npm run dev:frontend`. Міграції та сид: `npm run migrate`, `npm run seed`. Для стабільних паролів після seed додайте в `.env` `SEED_ADMIN_PASSWORD` та `SEED_USER_PASSWORD` (див. `.env.example`); якщо їх немає в **development**, seed згенерує паролі й покаже їх у терміналі.

## Структура

| Пакет | Шлях |
|--------|------|
| Frontend | `packages/frontend` |
| Backend API | `packages/backend` |
| Mediator | `packages/mediator` |

Скопіюйте `.env.example` у корені та у `packages/backend` / `packages/frontend` за потреби (див. `DOCS.txt` та `QUICK_START_AI.md` для AI). Деплой Docker: `deploy/env.docker.example` — там приклад **`GITHUB_*` / `FRONTEND_URL`**: у GitHub OAuth App поля Homepage і Authorization callback мають бути повними URL (`http://...` або `https://...`), символ у символ як у серверному `.env`.
## Ліцензія

MIT
