/**
 * GitHub Webhook receiver — POST /api/github/webhook
 *
 * Підтримує події 'push', 'star', 'public', 'repository'. На 'push' інкрементує
 * 30-day commit-лічильник у `users.github_stack.activityRecent` і оновлює
 * закешовані метадані репозиторію (зірки/форки) у user_repositories
 * та content_linked_repos.
 *
 * Налаштування:
 *   GITHUB_WEBHOOK_SECRET — спільний секрет (HMAC-SHA256 у X-Hub-Signature-256)
 *
 * Локально: ngrok http 3338, у GitHub repo settings → Webhooks → payload URL:
 *   https://<ngrok>/api/github/webhook
 *   Content-Type: application/json; Secret: ваш GITHUB_WEBHOOK_SECRET
 */

import express from 'express';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { UserRepository } from '../models/UserRepository.js';
import { ContentLinkedRepo } from '../models/ContentLinkedRepo.js';
import { fetchPublicRepoMetadata } from '../services/githubService.js';
import pool from '../config/database.js';

const router = express.Router();

function verifySignature(rawBody, signatureHeader, secret) {
  if (!secret) return null; // секрет не налаштовано → відключаємо перевірку (dev)
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = 'sha256=' +
    crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

// raw body парсер — потрібен для HMAC підпису.
router.post(
  '/webhook',
  express.raw({ type: '*/*', limit: '1mb' }),
  async (req, res) => {
    const signature = req.get('X-Hub-Signature-256');
    const event = req.get('X-GitHub-Event') || 'ping';
    const deliveryId = req.get('X-GitHub-Delivery') || 'no-id';
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    const verified = verifySignature(req.body, signature, secret);
    if (secret && verified === false) {
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    let payload = {};
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid JSON' });
    }

    if (event === 'ping') {
      return res.json({ success: true, message: 'pong', zen: payload.zen });
    }

    try {
      const repo = payload?.repository;
      if (repo?.id) {
        // Оновлюємо stars/forks у нашому кеші для всіх посилань на цей repo.
        try {
          await ContentLinkedRepo.refreshMetadata(repo.id, repo);
        } catch (e) {
          console.warn('[webhook] refresh content_linked_repos failed:', e.message);
        }
      }

      switch (event) {
        case 'push': {
          // Знайдемо локального користувача за owner.login
          const login = repo?.owner?.login;
          const commitsCount = Array.isArray(payload.commits) ? payload.commits.length : 0;
          if (login && commitsCount > 0) {
            const [[user]] = await pool.execute(
              'SELECT id, github_stack FROM users WHERE github_login = ?',
              [login]
            );
            if (user) {
              let stack = {};
              try { stack = JSON.parse(user.github_stack || '{}'); } catch { stack = {}; }
              const prev = stack.recentCommits30d || 0;
              stack.recentCommits30d = prev + commitsCount;
              stack.lastPushAt = new Date().toISOString();
              await pool.execute(
                'UPDATE users SET github_stack = ?, updated_at = NOW() WHERE id = ?',
                [JSON.stringify(stack), user.id]
              );

              // Якщо це власний repo — оновити кеш метаданих.
              if (repo?.id) {
                try {
                  // Не дзвонимо GitHub API заради збереження ліміту — використовуємо payload.
                  await UserRepository.upsertMany(user.id, [repo]);
                } catch (e) {
                  console.warn('[webhook] upsert user repo:', e.message);
                }
              }
            }
          }
          break;
        }

        case 'star':
        case 'public':
        case 'repository': {
          // Підтягуємо актуальні метадані; payload містить repo, але не завжди стабільно.
          if (repo?.full_name) {
            try {
              const fresh = await fetchPublicRepoMetadata(repo.full_name, null);
              await ContentLinkedRepo.refreshMetadata(fresh.id, fresh);
            } catch (e) {
              console.warn('[webhook] fetchPublicRepoMetadata:', e.message);
            }
          }
          break;
        }

        default:
          break;
      }

      res.json({
        success: true,
        message: `Event '${event}' processed`,
        delivery: deliveryId,
      });
    } catch (err) {
      console.error('[webhook] error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

export default router;
