# @ukroverflow/mediator

Візуалізований паттерн Mediator для централізованого управління подіями в UkrOverflow.

## Особливості

- 🎯 **Event Bus** - централізована система подій
- 📊 **Візуалізація** - панель розробника з графом взаємодії
- 📈 **Метрики** - відстеження продуктивності
- 🔍 **Debug** - повна історія подій
- 🎨 **Брутализм** - дизайн в стилі терміналу
- 🚀 **Продуктивність** - async обробка подій

## Встановлення

```bash
npm install @ukroverflow/mediator
```

## Використання

### Базове використання

```javascript
import { createMediator, EventTypes } from '@ukroverflow/mediator';
import { createVisualizer } from '@ukroverflow/mediator/visualizer';

// Створення медіатора
const mediator = createMediator({
  debug: true,
  visualization: true,
  logLevel: 'info'
});

// Підключення візуалізатора
const visualizer = createVisualizer({
  position: 'bottom-right',
  autoOpen: true
});

mediator.setVisualizer(visualizer);

// Реєстрація компонента
mediator.register('UserComponent', userComponentInstance);

// Підписка на подію
mediator.on(EventTypes.USER_LOGIN, (data) => {
  console.log('Користувач увійшов:', data);
}, 'UserComponent');

// Відправка події
mediator.emit(EventTypes.USER_LOGIN, {
  userId: 123,
  username: 'Тарас'
}, 'AuthComponent');
```

### Типи подій

```javascript
// Користувач
EventTypes.USER_LOGIN
EventTypes.USER_LOGOUT
EventTypes.USER_REGISTER
EventTypes.USER_PROFILE_UPDATE

// Питання
EventTypes.QUESTION_CREATE
EventTypes.QUESTION_UPDATE
EventTypes.QUESTION_DELETE
EventTypes.QUESTION_VIEW
EventTypes.QUESTION_VOTE

// Відповіді
EventTypes.ANSWER_CREATE
EventTypes.ANSWER_UPDATE
EventTypes.ANSWER_DELETE
EventTypes.ANSWER_VOTE
EventTypes.ANSWER_ACCEPT

// Навігація
EventTypes.NAVIGATION_CHANGE

// Пошук
EventTypes.SEARCH_QUERY
EventTypes.SEARCH_RESULTS

// Повідомлення
EventTypes.NOTIFICATION_SHOW
EventTypes.NOTIFICATION_CLEAR

// Система
EventTypes.ERROR
EventTypes.LOADING_START
EventTypes.LOADING_END
EventTypes.STATE_CHANGE
```

### React приклад

```javascript
import { useEffect } from 'react';
import { getMediator, EventTypes } from '@ukroverflow/mediator';

function QuestionList() {
  const mediator = getMediator();

  useEffect(() => {
    mediator.register('QuestionList', { name: 'QuestionList' });

    const unsubscribe = mediator.on(
      EventTypes.QUESTION_CREATE,
      (data) => {
        console.log('Нове питання:', data);
        // Оновити список
      },
      'QuestionList'
    );

    return () => {
      unsubscribe();
      mediator.unregister('QuestionList');
    };
  }, []);

  const handleCreate = async (question) => {
    await mediator.emit(
      EventTypes.QUESTION_CREATE,
      question,
      'QuestionList'
    );
  };

  return <div>...</div>;
}
```

### Метрики

```javascript
const metrics = mediator.getMetrics();

console.log('Загальна кількість подій:', metrics.totalEvents);
console.log('Середній час обробки:', metrics.averageProcessingTime);
console.log('Помилки:', metrics.errors);
console.log('Компоненти:', metrics.components);
```

### Історія подій

```javascript
// Вся історія
const history = mediator.getHistory();

// Фільтрація
const loginEvents = mediator.getHistory({
  type: EventTypes.USER_LOGIN,
  limit: 10
});

// Очищення історії
mediator.clearHistory();
```

## Візуалізатор

### Клавіатурні скорочення

- `Ctrl/Cmd + Shift + M` - відкрити/закрити панель

### Вкладки

1. **Події** - список всіх подій в реальному часі
2. **Метрики** - статистика роботи медіатора
3. **Граф** - візуалізація взаємодії компонентів
4. **Компоненти** - список зареєстрованих компонентів

### Налаштування

```javascript
const visualizer = createVisualizer({
  position: 'bottom-right', // або 'bottom-left', 'top-right', 'top-left'
  width: 400,
  height: 600,
  theme: 'brutalism',
  autoOpen: false
});
```

## API

### Mediator

#### `createMediator(options)`
Створює новий інстанс медіатора (singleton).

**Опції:**
- `debug` (boolean) - режим відладки
- `visualization` (boolean) - увімкнути візуалізацію
- `maxHistorySize` (number) - максимальний розмір історії
- `logLevel` ('debug'|'info'|'warn'|'error') - рівень логування

#### `getMediator()`
Повертає існуючий інстанс медіатора.

#### `register(componentName, componentInstance)`
Реєструє компонент в медіаторі.

#### `unregister(componentName)`
Видаляє компонент з медіатора.

#### `on(eventType, handler, componentName)`
Підписка на подію. Повертає функцію для відписки.

#### `once(eventType, handler, componentName)`
Одноразова підписка на подію.

#### `off(eventType, handler)`
Відписка від події.

#### `emit(eventType, data, componentName)`
Відправка події. Повертає Promise з інформацією про обробку.

#### `getHistory(filter)`
Отримання історії подій з можливістю фільтрації.

#### `clearHistory()`
Очищення історії подій.

#### `getMetrics()`
Отримання метрик роботи медіатора.

#### `setVisualizer(visualizer)`
Підключення візуалізатора.

## Архітектура

```
┌─────────────────────────────────────────┐
│           MEDIATOR CORE                 │
│  ┌───────────────────────────────────┐  │
│  │     Event Bus                     │  │
│  │  - Handlers Map                   │  │
│  │  - Event Queue                    │  │
│  │  - Async Processing               │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │     Components Registry           │  │
│  │  - Components Map                 │  │
│  │  - Lifecycle Management           │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │     Metrics & History             │  │
│  │  - Events History                 │  │
│  │  - Performance Metrics            │  │
│  │  - Error Tracking                 │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│        VISUALIZER                       │
│  ┌───────────────────────────────────┐  │
│  │  Events Tab                       │  │
│  │  Metrics Tab                      │  │
│  │  Graph Tab                        │  │
│  │  Components Tab                   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Приклади

### Система авторизації

```javascript
// AuthService.js
class AuthService {
  constructor(mediator) {
    this.mediator = mediator;
    mediator.register('AuthService', this);
  }

  async login(credentials) {
    try {
      const response = await api.login(credentials);

      await this.mediator.emit(
        EventTypes.USER_LOGIN,
        { user: response.user },
        'AuthService'
      );

      return response;
    } catch (error) {
      await this.mediator.emit(
        EventTypes.ERROR,
        { error: error.message, context: 'login' },
        'AuthService'
      );
      throw error;
    }
  }
}

// Header.jsx
function Header() {
  const mediator = getMediator();

  useEffect(() => {
    mediator.register('Header', { name: 'Header' });

    const unsubscribe = mediator.on(
      EventTypes.USER_LOGIN,
      (data) => {
        setUser(data.user);
      },
      'Header'
    );

    return () => {
      unsubscribe();
      mediator.unregister('Header');
    };
  }, []);

  return <header>...</header>;
}
```

### Система повідомлень

```javascript
function NotificationSystem() {
  const mediator = getMediator();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    mediator.register('NotificationSystem', { name: 'NotificationSystem' });

    const unsubscribe = mediator.on(
      EventTypes.NOTIFICATION_SHOW,
      (data) => {
        setNotifications(prev => [...prev, data]);
      },
      'NotificationSystem'
    );

    return () => {
      unsubscribe();
      mediator.unregister('NotificationSystem');
    };
  }, []);

  // Використання в інших компонентах:
  // mediator.emit(EventTypes.NOTIFICATION_SHOW, {
  //   message: 'Питання створено',
  //   type: 'success'
  // }, 'QuestionForm');

  return <div>...</div>;
}
```

## Ліцензія

MIT
