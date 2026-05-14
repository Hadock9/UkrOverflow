/**
 * Візуалізатор для Mediator
 * Показує граф взаємодії компонентів, події, метрики в реальному часі
 */

export class MediatorVisualizer {
  constructor(options = {}) {
    this.options = {
      position: options.position ?? 'bottom-right',
      width: options.width ?? 400,
      height: options.height ?? 600,
      theme: options.theme ?? 'brutalism',
      autoOpen: options.autoOpen ?? false,
      ...options
    };

    this.isOpen = this.options.autoOpen;
    this.currentTab = 'events';
    this.data = {
      history: [],
      metrics: {},
      components: []
    };

    this._init();
  }

  _init() {
    if (typeof document === 'undefined') {
      console.warn('[MediatorVisualizer] Недоступно в не-браузерному середовищі');
      return;
    }

    this._createContainer();
    this._createStyles();
    this._attachEventListeners();
    this._render();

    // Глобальний доступ для дебагу
    if (typeof window !== 'undefined') {
      window.__MEDIATOR_VISUALIZER__ = this;
    }
  }

  _createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'mediator-visualizer';
    this.container.className = `mediator-visualizer ${this.isOpen ? 'open' : 'closed'}`;

    document.body.appendChild(this.container);
  }

  _createStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Mediator Visualizer - Brutalism Design */
      .mediator-visualizer {
        position: fixed;
        ${this.options.position.includes('right') ? 'right: 0;' : 'left: 0;'}
        ${this.options.position.includes('bottom') ? 'bottom: 0;' : 'top: 0;'}
        width: ${this.options.width}px;
        height: ${this.options.height}px;
        background: #000;
        border: 4px solid #00ff00;
        color: #00ff00;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        z-index: 999999;
        transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        display: flex;
        flex-direction: column;
        box-shadow: -8px -8px 0 rgba(0, 255, 0, 0.3);
      }

      .mediator-visualizer.closed {
        transform: ${
          this.options.position.includes('right')
            ? `translateX(${this.options.width}px)`
            : `translateX(-${this.options.width}px)`
        };
      }

      .mediator-visualizer.open {
        transform: translateX(0);
      }

      /* Toggle Button */
      .mv-toggle {
        position: absolute;
        ${this.options.position.includes('right') ? 'left: -48px;' : 'right: -48px;'}
        top: 20px;
        width: 44px;
        height: 44px;
        background: #000;
        border: 4px solid #00ff00;
        color: #00ff00;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        transition: all 0.2s;
        user-select: none;
      }

      .mv-toggle:hover {
        background: #00ff00;
        color: #000;
        transform: scale(1.1);
      }

      .mv-toggle:active {
        transform: scale(0.95);
      }

      /* Header */
      .mv-header {
        background: #00ff00;
        color: #000;
        padding: 12px;
        font-weight: bold;
        border-bottom: 4px solid #00ff00;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .mv-title {
        font-size: 14px;
        letter-spacing: 2px;
      }

      .mv-controls {
        display: flex;
        gap: 8px;
      }

      .mv-btn {
        background: #000;
        color: #00ff00;
        border: 2px solid #00ff00;
        padding: 4px 8px;
        cursor: pointer;
        font-family: inherit;
        font-size: 11px;
        transition: all 0.2s;
      }

      .mv-btn:hover {
        background: #00ff00;
        color: #000;
      }

      /* Tabs */
      .mv-tabs {
        display: flex;
        background: #000;
        border-bottom: 2px solid #00ff00;
      }

      .mv-tab {
        flex: 1;
        padding: 10px;
        text-align: center;
        cursor: pointer;
        border-right: 2px solid #00ff00;
        transition: all 0.2s;
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 1px;
      }

      .mv-tab:last-child {
        border-right: none;
      }

      .mv-tab:hover {
        background: rgba(0, 255, 0, 0.1);
      }

      .mv-tab.active {
        background: #00ff00;
        color: #000;
        font-weight: bold;
      }

      /* Content */
      .mv-content {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        background: #000;
      }

      .mv-content::-webkit-scrollbar {
        width: 8px;
      }

      .mv-content::-webkit-scrollbar-track {
        background: #000;
        border-left: 2px solid #00ff00;
      }

      .mv-content::-webkit-scrollbar-thumb {
        background: #00ff00;
        border: 1px solid #000;
      }

      /* Events List */
      .mv-event {
        background: rgba(0, 255, 0, 0.05);
        border: 2px solid #00ff00;
        padding: 8px;
        margin-bottom: 8px;
        font-size: 11px;
      }

      .mv-event-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
        font-weight: bold;
      }

      .mv-event-type {
        color: #00ff00;
      }

      .mv-event-time {
        color: #00ff00;
        opacity: 0.7;
      }

      .mv-event-source {
        color: #00ff00;
        opacity: 0.8;
        margin-bottom: 4px;
      }

      .mv-event-data {
        background: #fff;
        border: 1px solid #00ff00;
        padding: 4px;
        margin-top: 4px;
        max-height: 100px;
        overflow-y: auto;
        font-size: 10px;
        color: #000;
      }

      .mv-event-data pre {
        color: #000;
        margin: 0;
      }

      /* Metrics */
      .mv-metric {
        background: rgba(0, 255, 0, 0.05);
        border: 2px solid #00ff00;
        padding: 12px;
        margin-bottom: 12px;
      }

      .mv-metric-title {
        font-weight: bold;
        margin-bottom: 8px;
        color: #00ff00;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .mv-metric-value {
        font-size: 24px;
        color: #00ff00;
        font-weight: bold;
      }

      .mv-metric-label {
        font-size: 10px;
        color: #00ff00;
        opacity: 0.7;
        margin-top: 4px;
      }

      /* Graph */
      .mv-graph {
        width: 100%;
        height: 400px;
        background: rgba(0, 255, 0, 0.05);
        border: 2px solid #00ff00;
        position: relative;
      }

      .mv-graph-node {
        position: absolute;
        background: #000;
        border: 2px solid #00ff00;
        padding: 8px;
        font-size: 10px;
        cursor: pointer;
        transition: all 0.2s;
        min-width: 80px;
        text-align: center;
      }

      .mv-graph-node:hover {
        background: #00ff00;
        color: #000;
        transform: scale(1.1);
        z-index: 10;
      }

      .mv-graph-connection {
        position: absolute;
        background: #00ff00;
        height: 2px;
        transform-origin: left center;
        pointer-events: none;
      }

      /* Components */
      .mv-component {
        background: rgba(0, 255, 0, 0.05);
        border: 2px solid #00ff00;
        padding: 10px;
        margin-bottom: 8px;
      }

      .mv-component-name {
        font-weight: bold;
        color: #00ff00;
        margin-bottom: 4px;
      }

      .mv-component-stats {
        font-size: 10px;
        color: #00ff00;
        opacity: 0.8;
      }

      /* Empty State */
      .mv-empty {
        text-align: center;
        padding: 40px 20px;
        color: #00ff00;
        opacity: 0.5;
      }

      /* Animation */
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .mv-pulse {
        animation: pulse 2s infinite;
      }
    `;

    document.head.appendChild(style);
  }

  _attachEventListeners() {
    // Клавіатурні скорочення
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + M - toggle visualizer
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.container.classList.toggle('open');
    this.container.classList.toggle('closed');
  }

  update(data) {
    this.data = {
      ...this.data,
      ...data
    };
    this._render();
  }

  _render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="mv-toggle" onclick="window.__MEDIATOR_VISUALIZER__.toggle()">
        ${this.isOpen ? '✕' : '◆'}
      </div>

      <div class="mv-header">
        <div class="mv-title">MEDIATOR DEBUG</div>
        <div class="mv-controls">
          <button class="mv-btn" onclick="window.__MEDIATOR_VISUALIZER__.clearData()">
            ОЧИСТИТИ
          </button>
        </div>
      </div>

      <div class="mv-tabs">
        ${this._renderTabs()}
      </div>

      <div class="mv-content">
        ${this._renderContent()}
      </div>
    `;
  }

  _renderTabs() {
    const tabs = [
      { id: 'events', label: 'Події' },
      { id: 'metrics', label: 'Метрики' },
      { id: 'components', label: 'Компоненти' }
    ];

    return tabs
      .map(
        (tab) => `
        <div
          class="mv-tab ${tab.id === this.currentTab ? 'active' : ''}"
          onclick="window.__MEDIATOR_VISUALIZER__.setTab('${tab.id}')"
        >
          ${tab.label}
        </div>
      `
      )
      .join('');
  }

  _renderContent() {
    switch (this.currentTab) {
      case 'events':
        return this._renderEvents();
      case 'metrics':
        return this._renderMetrics();
      case 'graph':
        return this._renderGraph();
      case 'components':
        return this._renderComponents();
      default:
        return '<div class="mv-empty">Невідома вкладка</div>';
    }
  }

  _renderEvents() {
    const events = this.data.history?.slice(-50).reverse() || [];

    if (events.length === 0) {
      return '<div class="mv-empty">Немає подій</div>';
    }

    return events
      .map(
        (event) => `
        <div class="mv-event">
          <div class="mv-event-header">
            <span class="mv-event-type">${event.type}</span>
            <span class="mv-event-time">${this._formatTime(event.timestamp)}</span>
          </div>
          <div class="mv-event-source">
            від: ${event.source} ${event.processingTime ? `(${event.processingTime.toFixed(2)}ms)` : ''}
          </div>
          ${
            event.errors?.length > 0
              ? `<div style="color: red;">❌ Помилки: ${event.errors.length}</div>`
              : ''
          }
          ${
            Object.keys(event.data || {}).length > 0
              ? `
            <details>
              <summary style="cursor: pointer; color: #00ff00;">Дані події</summary>
              <div class="mv-event-data">
                <pre>${JSON.stringify(event.data, null, 2)}</pre>
              </div>
            </details>
          `
              : ''
          }
        </div>
      `
      )
      .join('');
  }

  _renderMetrics() {
    const metrics = this.data.metrics || {};

    return `
      <div class="mv-metric">
        <div class="mv-metric-title">Загальна кількість подій</div>
        <div class="mv-metric-value">${metrics.totalEvents || 0}</div>
      </div>

      <div class="mv-metric">
        <div class="mv-metric-title">Середній час обробки</div>
        <div class="mv-metric-value">${(metrics.averageProcessingTime || 0).toFixed(2)} мс</div>
      </div>

      <div class="mv-metric">
        <div class="mv-metric-title">Помилки</div>
        <div class="mv-metric-value" style="color: ${metrics.errors > 0 ? 'red' : '#00ff00'}">
          ${metrics.errors || 0}
        </div>
      </div>

      <div class="mv-metric">
        <div class="mv-metric-title">Події за типами</div>
        ${
          metrics.eventTypes?.length > 0
            ? metrics.eventTypes
                .map(
                  (et) => `
            <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 11px;">
              <span>${et.type}</span>
              <span style="font-weight: bold;">${et.count}</span>
            </div>
          `
                )
                .join('')
            : '<div class="mv-empty">Немає даних</div>'
        }
      </div>
    `;
  }

  _renderGraph() {
    const components = this.data.metrics?.components || [];

    if (components.length === 0) {
      return '<div class="mv-empty">Немає компонентів для відображення</div>';
    }

    // Простий граф з позиціюванням компонентів
    const graphHtml = components
      .map((comp, index) => {
        const x = 20 + (index % 3) * 110;
        const y = 20 + Math.floor(index / 3) * 80;

        return `
        <div class="mv-graph-node" style="left: ${x}px; top: ${y}px;">
          <div style="font-weight: bold;">${comp.name}</div>
          <div style="font-size: 9px; margin-top: 4px;">
            ↑${comp.eventsEmitted} ↓${comp.eventsReceived}
          </div>
        </div>
      `;
      })
      .join('');

    return `
      <div class="mv-graph">
        ${graphHtml}
      </div>
      <div style="margin-top: 12px; font-size: 10px; opacity: 0.7;">
        ↑ - відправлено, ↓ - отримано
      </div>
    `;
  }

  _renderComponents() {
    const components = this.data.metrics?.components || [];

    if (components.length === 0) {
      return '<div class="mv-empty">Немає зареєстрованих компонентів</div>';
    }

    return components
      .map(
        (comp) => `
        <div class="mv-component">
          <div class="mv-component-name">${comp.name}</div>
          <div class="mv-component-stats">
            Відправлено подій: ${comp.eventsEmitted}<br>
            Отримано подій: ${comp.eventsReceived}<br>
            Зареєстровано: ${this._formatTime(comp.registeredAt)}
          </div>
        </div>
      `
      )
      .join('');
  }

  _formatTime(date) {
    if (!date) return '-';
    const d = new Date(date);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  }

  setTab(tabId) {
    this.currentTab = tabId;
    this._render();
  }

  clearData() {
    if (typeof window !== 'undefined' && window.__MEDIATOR_DEBUG__) {
      window.__MEDIATOR_DEBUG__.clearHistory();
    }
    this._render();
  }
}

export function createVisualizer(options = {}) {
  return new MediatorVisualizer(options);
}

export default MediatorVisualizer;
