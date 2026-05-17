/**
 * Шаблони тижневих челенджів (ротація для історії).
 */

export const CHALLENGE_WEEK_SETS = [
  {
    algorithms: {
      title: 'Алгоритми: Two Sum за O(n)',
      description:
        'Реалізуйте twoSum(nums, target) з індексами двох чисел. Поясніть часову та просторову складність.',
      criteria: { timeLimit: 'O(n)', language: 'any' },
      pointsMax: 100,
    },
    bug_fixing: {
      title: 'Bug fixing: зламаний fetch',
      description:
        'Знайдіть баг у коді, що ламає обробку помилок API. Опишіть root cause та виправлення.',
      criteria: { mustInclude: 'PR або gist з diff' },
      pointsMax: 80,
    },
    mini_project: {
      title: 'Mini project: TODO з localStorage',
      description:
        'Міні-додаток TODO (додати / видалити / фільтр) з localStorage. UI на ваш смак.',
      criteria: { deploy: 'optional', repo: 'required' },
      pointsMax: 120,
    },
  },
  {
    algorithms: {
      title: 'Алгоритми: валідні дужки',
      description: 'Перевірте рядок з дужками ()[]{} — стек за O(n). Додайте тести.',
      criteria: { timeLimit: 'O(n)' },
      pointsMax: 90,
    },
    bug_fixing: {
      title: 'Bug fixing: race condition у async',
      description: 'Виправте гонку в async-коді (подвійний submit / stale state).',
      criteria: { mustInclude: 'пояснення причини' },
      pointsMax: 85,
    },
    mini_project: {
      title: 'Mini project: погодний віджет',
      description: 'Віджет погоди з open API, кешуванням і обробкою помилок.',
      criteria: { api: 'required' },
      pointsMax: 110,
    },
  },
  {
    algorithms: {
      title: 'Алгоритми: бінарний пошук',
      description: 'Реалізуйте binarySearch з коректними межами left/right. Edge cases обовʼязкові.',
      criteria: { timeLimit: 'O(log n)' },
      pointsMax: 95,
    },
    bug_fixing: {
      title: 'Bug fixing: memory leak у SPA',
      description: 'Знайдіть витік памʼяті (listeners / timers) у React/Vanilla JS.',
      criteria: { tools: 'DevTools' },
      pointsMax: 90,
    },
    mini_project: {
      title: 'Mini project: markdown notes',
      description: 'Нотатник з preview Markdown і збереженням у localStorage.',
      criteria: { markdown: 'required' },
      pointsMax: 115,
    },
  },
  {
    algorithms: {
      title: 'Алгоритми: BFS у графі',
      description: 'Обійдіть граф BFS від стартової вершини. Поверніть відстані до всіх вузлів.',
      criteria: { graph: 'adjacency list' },
      pointsMax: 100,
    },
    bug_fixing: {
      title: 'Bug fixing: CORS і preflight',
      description: 'Діагностуйте і виправте CORS/preflight помилку між фронтом і API.',
      criteria: { mustInclude: 'headers' },
      pointsMax: 75,
    },
    mini_project: {
      title: 'Mini project: quiz app',
      description: 'Міні-вікторина з таймером, рахунком і екраном результатів.',
      criteria: { questions: '>=5' },
      pointsMax: 100,
    },
  },
  {
    algorithms: {
      title: 'Алгоритми: merge sort',
      description: 'Реалізуйте merge sort in-place або з додатковою памʼяттю. Порівняйте складність.',
      criteria: { stable: 'optional' },
      pointsMax: 100,
    },
    bug_fixing: {
      title: 'Bug fixing: SQL N+1',
      description: 'Оптимізуйте N+1 запити в ORM/SQL. Покажіть до/після.',
      criteria: { explain: 'query plan' },
      pointsMax: 90,
    },
    mini_project: {
      title: 'Mini project: expense tracker',
      description: 'Облік витрат з категоріями, фільтром і простою статистикою.',
      criteria: { charts: 'optional' },
      pointsMax: 125,
    },
  },
  {
    algorithms: {
      title: 'Алгоритми: LRU cache',
      description: 'Реалізуйте LRU cache з get/put за O(1) (Map + doubly linked list).',
      criteria: { capacity: 'parameter' },
      pointsMax: 120,
    },
    bug_fixing: {
      title: 'Bug fixing: XSS у innerHTML',
      description: 'Усуньте XSS через небезпечний innerHTML. Запропонуйте safe alternative.',
      criteria: { sanitize: 'required' },
      pointsMax: 85,
    },
    mini_project: {
      title: 'Mini project: pomodoro timer',
      description: 'Pomodoro таймер з звуком/нотифікацією і збереженням сесій.',
      criteria: { sessions: 'history' },
      pointsMax: 100,
    },
  },
  {
    algorithms: {
      title: 'Алгоритми: longest substring',
      description: 'Знайдіть найдовший підрядок без повторів символів (sliding window).',
      criteria: { timeLimit: 'O(n)' },
      pointsMax: 100,
    },
    bug_fixing: {
      title: 'Bug fixing: off-by-one у пагінації',
      description: 'Виправте пагінацію API/UI (off-by-one, total pages).',
      criteria: { tests: 'required' },
      pointsMax: 70,
    },
    mini_project: {
      title: 'Mini project: habit tracker',
      description: 'Трекер звичок з календарем streak і localStorage.',
      criteria: { streak: 'required' },
      pointsMax: 110,
    },
  },
  {
    algorithms: {
      title: 'Алгоритми: topological sort',
      description: 'Топологічне сортування DAG. Обробіть цикл (повідомлення про помилку).',
      criteria: { cycleDetection: true },
      pointsMax: 110,
    },
    bug_fixing: {
      title: 'Bug fixing: WebSocket reconnect',
      description: 'Стабільний reconnect/backoff для WebSocket клієнта.',
      criteria: { backoff: 'exponential' },
      pointsMax: 90,
    },
    mini_project: {
      title: 'Mini project: URL shortener UI',
      description: 'UI скорочувача посилань (mock API або localStorage).',
      criteria: { copy: 'clipboard' },
      pointsMax: 95,
    },
  },
];

export function getWeekBoundsForDate(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  };
}

export function shiftWeeksFromToday(weeksAgo) {
  const d = new Date();
  d.setDate(d.getDate() - weeksAgo * 7);
  return getWeekBoundsForDate(d);
}
