/**
 * @ukroverflow/mediator
 * Візуалізований паттерн Mediator з повною системою подій
 *
 * Основні можливості:
 * - Event Bus для комунікації компонентів
 * - Візуалізація подій в реальному часі
 * - Граф взаємодії компонентів
 * - Метрики продуктивності
 * - Історія подій
 * - Debug панель
 */

/**
 * Типи подій в системі
 */
export const EventTypes = {
  // Користувач
  USER_LOGIN: 'user:login',
  USER_LOGOUT: 'user:logout',
  USER_REGISTER: 'user:register',
  USER_PROFILE_UPDATE: 'user:profile:update',

  // Питання
  QUESTION_CREATE: 'question:create',
  QUESTION_UPDATE: 'question:update',
  QUESTION_DELETE: 'question:delete',
  QUESTION_VIEW: 'question:view',
  QUESTION_VOTE: 'question:vote',

  // Відповіді
  ANSWER_CREATE: 'answer:create',
  ANSWER_UPDATE: 'answer:update',
  ANSWER_DELETE: 'answer:delete',
  ANSWER_VOTE: 'answer:vote',
  ANSWER_ACCEPT: 'answer:accept',

  // Теги
  TAG_FILTER: 'tag:filter',
  TAG_CREATE: 'tag:create',

  // Навігація
  NAVIGATION_CHANGE: 'navigation:change',

  // Пошук
  SEARCH_QUERY: 'search:query',
  SEARCH_RESULTS: 'search:results',

  // Повідомлення
  NOTIFICATION_SHOW: 'notification:show',
  NOTIFICATION_CLEAR: 'notification:clear',

  // Система
  ERROR: 'system:error',
  LOADING_START: 'system:loading:start',
  LOADING_END: 'system:loading:end',
  STATE_CHANGE: 'system:state:change',

  // API
  API_REQUEST: 'api:request',
  API_SUCCESS: 'api:success',
  API_ERROR: 'api:error',

  // Дії користувача
  USER_ACTION: 'user:action',

  // Повідомлення
  NOTIFICATION: 'notification'
};

/**
 * Основний клас Mediator
 */
export class Mediator {
  constructor(options = {}) {
    this.handlers = new Map();
    this.history = [];
    this.components = new Map();
    this.metrics = {
      totalEvents: 0,
      eventsByType: new Map(),
      averageProcessingTime: 0,
      errors: 0
    };

    this.options = {
      debug: options.debug ?? true,
      visualization: options.visualization ?? true,
      maxHistorySize: options.maxHistorySize ?? 1000,
      logLevel: options.logLevel ?? 'info'
    };

    this.visualizer = null;

    if (this.options.debug) {
      this._setupDebugMode();
    }
  }

  /**
   * Реєстрація компонента в медіаторі
   */
  register(componentName, componentInstance) {
    if (this.components.has(componentName)) {
      console.warn(`[Mediator] Компонент "${componentName}" вже зареєстрований`);
      return;
    }

    this.components.set(componentName, {
      instance: componentInstance,
      registeredAt: new Date(),
      eventsEmitted: 0,
      eventsReceived: 0
    });

    this._log('info', `Компонент зареєстровано: ${componentName}`);
    this._updateVisualization();
  }

  /**
   * Видалення компонента з медіатора
   */
  unregister(componentName) {
    if (!this.components.has(componentName)) {
      console.warn(`[Mediator] Компонент "${componentName}" не знайдено`);
      return;
    }

    this.components.delete(componentName);
    this._log('info', `Компонент видалено: ${componentName}`);
    this._updateVisualization();
  }

  /**
   * Підписка на подію
   */
  on(eventType, handler, componentName = 'anonymous') {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    const handlerWrapper = {
      fn: handler,
      component: componentName,
      id: this._generateId()
    };

    this.handlers.get(eventType).push(handlerWrapper);

    this._log('debug', `Підписка на подію: ${eventType} від ${componentName}`);

    // Повертаємо функцію для відписки
    return () => this.off(eventType, handler);
  }

  /**
   * Відписка від події
   */
  off(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      return;
    }

    const handlers = this.handlers.get(eventType);
    const index = handlers.findIndex(h => h.fn === handler);

    if (index !== -1) {
      handlers.splice(index, 1);
      this._log('debug', `Відписка від події: ${eventType}`);
    }

    if (handlers.length === 0) {
      this.handlers.delete(eventType);
    }
  }

  /**
   * Одноразова підписка на подію
   */
  once(eventType, handler, componentName = 'anonymous') {
    const wrapper = (data) => {
      handler(data);
      this.off(eventType, wrapper);
    };

    return this.on(eventType, wrapper, componentName);
  }

  /**
   * Відправка події
   */
  async emit(eventType, data = {}, componentName = 'anonymous') {
    const startTime = performance.now();

    const event = {
      id: this._generateId(),
      type: eventType,
      data,
      source: componentName,
      timestamp: new Date(),
      processed: false,
      errors: []
    };

    // Оновлення метрик компонента
    if (this.components.has(componentName)) {
      this.components.get(componentName).eventsEmitted++;
    }

    this._log('info', `Подія: ${eventType} від ${componentName}`, data);

    // Отримання обробників
    const handlers = this.handlers.get(eventType) || [];

    // Виконання обробників
    const results = await Promise.allSettled(
      handlers.map(async ({ fn, component }) => {
        try {
          // Оновлення метрик компонента-отримувача
          if (this.components.has(component)) {
            this.components.get(component).eventsReceived++;
          }

          await fn(data, event);
          return { component, success: true };
        } catch (error) {
          event.errors.push({
            component,
            error: error.message,
            stack: error.stack
          });
          this._log('error', `Помилка обробки події ${eventType} в ${component}:`, error);
          return { component, success: false, error };
        }
      })
    );

    event.processed = true;
    event.processingTime = performance.now() - startTime;

    // Оновлення метрик
    this._updateMetrics(event);

    // Додавання до історії
    this._addToHistory(event);

    // Оновлення візуалізації
    this._updateVisualization();

    return event;
  }

  /**
   * Отримання історії подій
   */
  getHistory(filter = {}) {
    let filtered = [...this.history];

    if (filter.type) {
      filtered = filtered.filter(e => e.type === filter.type);
    }

    if (filter.source) {
      filtered = filtered.filter(e => e.source === filter.source);
    }

    if (filter.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  /**
   * Очищення історії
   */
  clearHistory() {
    this.history = [];
    this._log('info', 'Історія подій очищена');
    this._updateVisualization();
  }

  /**
   * Отримання метрик
   */
  getMetrics() {
    return {
      ...this.metrics,
      components: Array.from(this.components.entries()).map(([name, data]) => ({
        name,
        eventsEmitted: data.eventsEmitted,
        eventsReceived: data.eventsReceived,
        registeredAt: data.registeredAt
      })),
      eventTypes: Array.from(this.metrics.eventsByType.entries()).map(([type, count]) => ({
        type,
        count
      }))
    };
  }

  /**
   * Встановлення візуалізатора
   */
  setVisualizer(visualizer) {
    this.visualizer = visualizer;
    this._log('info', 'Візуалізатор підключено');
  }

  /**
   * Приватні методи
   */

  _generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  _addToHistory(event) {
    this.history.push(event);

    // Обмеження розміру історії
    if (this.history.length > this.options.maxHistorySize) {
      this.history.shift();
    }
  }

  _updateMetrics(event) {
    this.metrics.totalEvents++;

    // Підрахунок подій за типом
    const count = this.metrics.eventsByType.get(event.type) || 0;
    this.metrics.eventsByType.set(event.type, count + 1);

    // Середній час обробки
    const avgTime = this.metrics.averageProcessingTime;
    const total = this.metrics.totalEvents;
    this.metrics.averageProcessingTime =
      (avgTime * (total - 1) + event.processingTime) / total;

    // Підрахунок помилок
    if (event.errors.length > 0) {
      this.metrics.errors += event.errors.length;
    }
  }

  _updateVisualization() {
    if (this.visualizer && this.options.visualization) {
      this.visualizer.update({
        history: this.history,
        metrics: this.getMetrics(),
        components: Array.from(this.components.keys())
      });
    }
  }

  _setupDebugMode() {
    if (typeof window !== 'undefined') {
      window.__MEDIATOR_DEBUG__ = this;
    }

    this._log('info', 'Debug режим увімкнено');
  }

  _log(level, message, data) {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.options.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex < currentLevelIndex) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[Mediator ${timestamp}]`;

    switch (level) {
      case 'debug':
        console.debug(prefix, message, data || '');
        break;
      case 'info':
        console.info(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      case 'error':
        console.error(prefix, message, data || '');
        break;
    }
  }
}

/**
 * Singleton інстанс медіатора
 */
let mediatorInstance = null;

export function createMediator(options = {}) {
  if (mediatorInstance) {
    console.warn('[Mediator] Інстанс вже створено, повертаємо існуючий');
    return mediatorInstance;
  }

  mediatorInstance = new Mediator(options);
  return mediatorInstance;
}

export function getMediator() {
  if (!mediatorInstance) {
    throw new Error('[Mediator] Інстанс не створено. Викличте createMediator() спочатку');
  }

  return mediatorInstance;
}

export default Mediator;
