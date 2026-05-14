# UkrOverflow

Українська платформа питань і відповідей (аналог Stack Overflow). Monorepo: **frontend** (React + Vite), **backend** (Node.js), **mediator** (патерн посередника для взаємодії компонентів).

## Швидкий старт

У корені репозиторію:

```bash
npm install
npm run dev
```

Окремо: `npm run dev:backend`, `npm run dev:frontend`. Міграції та сид: `npm run migrate`, `npm run seed`.

## Структура

| Пакет | Шлях |
|--------|------|
| Frontend | `packages/frontend` |
| Backend API | `packages/backend` |
| Mediator | `packages/mediator` |

Скопіюйте `.env.example` у корені та у `packages/backend` / `packages/frontend` за потреби (див. `DOCS.txt` та `QUICK_START_AI.md` для AI).

## Ліцензія

MIT
