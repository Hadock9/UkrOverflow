/**
 * WebSocket Client для realtime updates
 */

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3338/ws';

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectTimeout = null;
    this.reconnectDelay = 3000;
    this.listeners = new Map();
    this.subscriptions = new Set();
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      console.log('✓ WebSocket підключено');

      // Відновити підписки
      this.subscriptions.forEach(channel => {
        this.subscribe(channel);
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'broadcast') {
          this.emit(data.channel, data.data);
        }
      } catch (error) {
        console.error('Помилка обробки WS повідомлення:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket помилка:', error);
    };

    this.ws.onclose = () => {
      console.log('✗ WebSocket відключено');
      this.scheduleReconnect();
    };
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimeout) {
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      console.log('Спроба перепідключення WebSocket...');
      this.connect();
    }, this.reconnectDelay);
  }

  subscribe(channel) {
    this.subscriptions.add(channel);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        channel
      }));
    }
  }

  unsubscribe(channel) {
    this.subscriptions.delete(channel);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        channel
      }));
    }
  }

  on(channel, handler) {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, []);
    }

    this.listeners.get(channel).push(handler);

    // Автоматична підписка на канал
    this.subscribe(channel);

    // Повернути функцію для відписки
    return () => this.off(channel, handler);
  }

  off(channel, handler) {
    if (!this.listeners.has(channel)) {
      return;
    }

    const handlers = this.listeners.get(channel);
    const index = handlers.indexOf(handler);

    if (index !== -1) {
      handlers.splice(index, 1);
    }

    if (handlers.length === 0) {
      this.listeners.delete(channel);
      this.unsubscribe(channel);
    }
  }

  emit(channel, data) {
    if (!this.listeners.has(channel)) {
      return;
    }

    this.listeners.get(channel).forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Помилка обробника для ${channel}:`, error);
      }
    });
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

// Singleton
const wsClient = new WebSocketClient();

export default wsClient;
