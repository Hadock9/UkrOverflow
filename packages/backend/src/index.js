/**
 * Головний файл backend сервера
 * DevFlow - без Strapi, без хардкодів
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';

import { parseFrontendOrigins } from './utils/frontendOrigin.js';

import { testConnection, closePool } from './config/database.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.js';
import questionsRoutes from './routes/questions.js';
import answersRoutes from './routes/answers.js';
import votesRoutes from './routes/votes.js';
import searchRoutes from './routes/search.js';
import usersRoutes from './routes/users.js';
import aiRoutes from './routes/ai.js';
import notificationsRoutes from './routes/notifications.js';
import bookmarksRoutes from './routes/bookmarks.js';
import statsRoutes from './routes/stats.js';
import articlesRoutes from './routes/articles.js';
import guidesRoutes from './routes/guides.js';
import snippetsRoutes from './routes/snippets.js';
import roadmapsRoutes from './routes/roadmaps.js';
import bestPracticesRoutes from './routes/bestPractices.js';
import faqsRoutes from './routes/faqs.js';
import contentRoutes from './routes/content.js';
import githubAuthRoutes from './routes/githubAuth.js';
import githubRoutes from './routes/github.js';
import githubWebhookRoutes from './routes/githubWebhook.js';
import communitiesRoutes from './routes/communities.js';
import communityPostsRoutes from './routes/communityPosts.js';
import mentorsRoutes from './routes/mentors.js';
import { logGithubOAuthRedirectUriHint } from './services/githubService.js';

// Завантаження змінних оточення
dotenv.config();

// Валідація обов'язкових змінних
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(
  (v) => process.env[v] === undefined || String(process.env[v]).trim() === ''
);

if (missingVars.length > 0) {
  console.error('❌ Відсутні обов\'язкові змінні оточення:', missingVars.join(', '));
  console.error('📝 Створіть файл .env на основі .env.example');
  process.exit(1);
}

const app = express();
const PORT = parseInt(process.env.API_PORT || '3338');
const HOST = process.env.API_HOST || 'localhost';

function productionCorsOrigin() {
  const list = parseFrontendOrigins();
  if (list.length === 0) return false;
  if (list.length === 1) return list[0];
  return list;
}

// Створення HTTP сервера
const server = createServer(app);

// WebSocket сервер
const wss = new WebSocketServer({ server, path: '/ws' });

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? productionCorsOrigin()
    : '*',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Visitor-Id', 'X-Record-View']
}));

// GitHub webhook потрібен у raw body для HMAC-перевірки — реєструємо ПЕРЕД express.json()
app.use('/api/github', githubWebhookRoutes);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 хвилин
  max: 100, // максимум 100 запитів
  message: {
    success: false,
    message: 'Забагато запитів з цієї IP, спробуйте пізніше'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Логування запитів в dev режимі
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'DevFlow API працює',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/answers', answersRoutes);
app.use('/api/votes', votesRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/bookmarks', bookmarksRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/articles', articlesRoutes);
app.use('/api/guides', guidesRoutes);
app.use('/api/snippets', snippetsRoutes);
app.use('/api/roadmaps', roadmapsRoutes);
app.use('/api/best-practices', bestPracticesRoutes);
app.use('/api/faqs', faqsRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/auth/github', githubAuthRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/communities', communitiesRoutes);
app.use('/api/community-posts', communityPostsRoutes);
app.use('/api/mentors', mentorsRoutes);

// WebSocket з'єднання
const clients = new Map();

wss.on('connection', (ws, req) => {
  const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  clients.set(clientId, ws);

  console.log(`✓ WebSocket клієнт підключено: ${clientId}`);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      // Обробка повідомлень від клієнта
      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        case 'subscribe':
          // Підписка на події
          ws.subscriptions = ws.subscriptions || new Set();
          ws.subscriptions.add(data.channel);
          break;

        case 'unsubscribe':
          // Відписка від подій
          if (ws.subscriptions) {
            ws.subscriptions.delete(data.channel);
          }
          break;

        default:
          console.warn('Невідомий тип повідомлення:', data.type);
      }
    } catch (error) {
      console.error('Помилка обробки WebSocket повідомлення:', error);
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`✗ WebSocket клієнт відключено: ${clientId}`);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket помилка (${clientId}):`, error);
    clients.delete(clientId);
  });
});

/**
 * Broadcast повідомлення всім підключеним клієнтам
 */
export function broadcast(channel, data) {
  const message = JSON.stringify({
    type: 'broadcast',
    channel,
    data,
    timestamp: Date.now()
  });

  clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      if (!ws.subscriptions || ws.subscriptions.has(channel)) {
        ws.send(message);
      }
    }
  });
}

// Глобальний доступ для інших модулів
global.broadcast = broadcast;

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM отримано, закриваємо сервер...');

  server.close(async () => {
    console.log('✓ HTTP сервер закрито');

    wss.clients.forEach((ws) => {
      ws.close();
    });
    console.log('✓ WebSocket з\'єднання закрито');

    await closePool();

    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT отримано, закриваємо сервер...');

  server.close(async () => {
    console.log('✓ HTTP сервер закрито');

    wss.clients.forEach((ws) => {
      ws.close();
    });
    console.log('✓ WebSocket з\'єднання закрито');

    await closePool();

    process.exit(0);
  });
});

// Запуск сервера
async function start() {
  try {
    // Перевірка з'єднання з БД
    await testConnection();

    logGithubOAuthRedirectUriHint();

    server.listen(PORT, HOST, () => {
      console.log('\n' + '='.repeat(50));
      console.log('🚀 DevFlow Backend Server');
      console.log('='.repeat(50));
      console.log(`📡 HTTP: http://${HOST}:${PORT}`);
      console.log(`🔌 WebSocket: ws://${HOST}:${PORT}/ws`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💾 Database: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
      console.log('='.repeat(50) + '\n');
    });
  } catch (error) {
    console.error('❌ Помилка запуску сервера:', error);
    process.exit(1);
  }
}

start();
