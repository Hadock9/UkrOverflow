# 🚀 ШВИДКИЙ СТАРТ - AI ФУНКЦІЇ

## За 5 хвилин до AI-powered UkrOverflow!

---

## Крок 1: Встановити залежності (вже зроблено ✓)

```bash
cd packages/backend
npm install
```

---

## Крок 2: Додати API ключ

### Варіант А: Використати існуючий ключ

Створіть файл `.env` у **кореневій папці** проекту:

```bash
# Скопіюйте з .env.example
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=ukroverflow
DB_USER=root
DB_PASSWORD=1111

API_PORT=3338
API_HOST=localhost

JWT_SECRET=your_jwt_secret_here_min_32_chars_long_abcdef1234567890

# 👇 ДОДАЙТЕ ЦЕЙ РЯДОК
GEMINI_API_KEY=your_gemini_api_key_here
```

### Варіант Б: Отримати свій ключ

1. Перейти на: https://aistudio.google.com/apikey
2. Увійти через Google
3. Натиснути "Create API Key"
4. Скопіювати ключ у `.env`

---

## Крок 3: Запустити проект

```bash
# У кореневій папці проекту
npm run dev
```

Або окремо:

```bash
# Terminal 1: Backend
cd packages/backend
npm run dev

# Terminal 2: Frontend
cd packages/frontend
npm run dev
```

---

## Крок 4: Перевірити що все працює

### Перевірка 1: Backend API
Відкрийте в браузері:
```
http://localhost:3338/api/ai/status
```

Повинно показати:
```json
{
  "success": true,
  "data": {
    "available": true,
    "models": {
      "flash": "gemini-2.0-flash-exp",
      "pro": "gemini-1.5-pro"
    },
    "features": [...]
  }
}
```

### Перевірка 2: Frontend
```
http://localhost:5175
```

1. Увійдіть (зареєстрований акаунт або після `npm run seed` — з паролями з `.env`, див. `SEED_*` у `.env.example`)
2. Відкрийте будь-яке питання
3. Побачите:
   - 🤖 TL;DR (AI) - якщо питання довге
   - 🤖 СХОЖІ ПИТАННЯ (AI) - внизу
   - ✨ AI ПІДКАЗКА - у формі відповіді

4. Створіть нове питання:
   - Введіть заголовок і опис
   - Натисніть 🏷️ AI ТЕГИ
   - Побачите запропоновані теги!

---

## 🎉 ГОТОВО!

### Ви маєте 5 AI функцій:

✅ **AI-помічник для відповідей** (Gemini Pro)
- Кнопка "✨ AI ПІДКАЗКА" на сторінці питання

✅ **Auto-tagging** (Gemini Flash)
- Кнопка "🏷️ AI ТЕГИ" при створенні питання

✅ **Модерація контенту** (Gemini Flash)
- Працює автоматично в backend

✅ **Smart summarization** (Gemini Flash)
- Автоматично для довгих питань

✅ **Схожі питання** (Gemini Flash)
- Автоматично на сторінці питання

---

## 🐛 Не працює?

### Помилка: "AI сервіс недоступний"

1. Перевірте `.env` файл у **кореневій папці**
2. Переконайтесь що `GEMINI_API_KEY` доданий
3. Перезапустіть backend (`npm run dev`)

### Помилка: "API key not valid"

1. Перевірте що ключ правильний (без пробілів)
2. Спробуйте створити новий ключ
3. Перевірте інтернет з'єднання

### Кнопки AI не з'являються

1. Очистіть кеш браузера (Ctrl+Shift+R)
2. Перевірте консоль браузера (F12)
3. Переконайтесь що frontend запущений

---

## 📚 Детальна документація

Читайте повну документацію в:
- **`AI_FEATURES.md`** - повний опис всіх функцій
- **`AI_INTEGRATION_SUMMARY.md`** - технічні деталі
- **`DOCS.txt`** - загальна документація проекту

---

## 💡 Корисні посилання

- Google AI Studio: https://aistudio.google.com
- Gemini API Docs: https://ai.google.dev/docs
- Ліміти безкоштовного тарифу: https://ai.google.dev/pricing

---

**Насолоджуйтесь AI-powered UkrOverflow! 🚀**
