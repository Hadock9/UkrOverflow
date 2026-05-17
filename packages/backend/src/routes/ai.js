import express from 'express';
import aiService from '../services/aiService.js';
import { authenticateToken } from '../middleware/auth.js';
import { Question } from '../models/Question.js';
import { Answer } from '../models/Answer.js';
import Article from '../models/Article.js';
import Guide from '../models/Guide.js';
import Snippet from '../models/Snippet.js';
import Roadmap from '../models/Roadmap.js';
import BestPractice from '../models/BestPractice.js';
import Faq from '../models/Faq.js';
import { CONTENT_TYPES } from '../constants/contentTypes.js';
import { flashModelId, proModelId } from '../config/gemini.js';
import { isGeminiQuotaOrRateLimitError } from '../utils/geminiErrors.js';

function isAiDisabled() {
  return process.env.AI_ENABLED === '0' || process.env.AI_ENABLED === 'false';
}

async function loadHubCatalog(limitPerType = 12) {
  const opts = { page: 1, limit: limitPerType, sortBy: 'created_at' };
  const catalog = [];

  const pushItems = (type, rows) => {
    for (const row of rows || []) {
      catalog.push({ type, id: row.id, title: row.title });
    }
  };

  const [questions, articles, guides, snippets, roadmaps, practices, faqs] = await Promise.all([
    Question.list(opts),
    Article.list(opts),
    Guide.list(opts),
    Snippet.list(opts),
    Roadmap.list(opts),
    BestPractice.list(opts),
    Faq.list(opts),
  ]);

  pushItems(CONTENT_TYPES.QUESTION, questions.questions);
  pushItems(CONTENT_TYPES.ARTICLE, articles.articles);
  pushItems(CONTENT_TYPES.GUIDE, guides.guides);
  pushItems(CONTENT_TYPES.SNIPPET, snippets.snippets);
  pushItems(CONTENT_TYPES.ROADMAP, roadmaps.roadmaps);
  pushItems(CONTENT_TYPES.BEST_PRACTICE, practices.bestPractices || practices.practices);
  pushItems(CONTENT_TYPES.FAQ, faqs.faqs);

  return catalog;
}

const router = express.Router();

/** In-memory кеш схожих питань: зменшує подвійні виклики (React Strict Mode) і навантаження на Gemini */
const similarQuestionsCache = new Map();

function cacheSimilarGet(questionId) {
  const row = similarQuestionsCache.get(questionId);
  if (!row || row.expiresAt <= Date.now()) {
    if (row) similarQuestionsCache.delete(questionId);
    return null;
  }
  return row.payload;
}

function cacheSimilarSet(questionId, payload, { isError } = { isError: false }) {
  while (similarQuestionsCache.size >= 120) {
    const oldest = similarQuestionsCache.keys().next().value;
    similarQuestionsCache.delete(oldest);
  }
  const ttlMs = isError ? 120_000 : 300_000;
  similarQuestionsCache.set(questionId, {
    expiresAt: Date.now() + ttlMs,
    payload,
  });
}

/**
 * POST /api/ai/suggest-answer
 * Генерує AI-підказку для відповіді на питання
 * Потребує авторизації
 */
router.post('/suggest-answer', authenticateToken, async (req, res) => {
  try {
    const { questionId } = req.body;

    if (!questionId) {
      return res.status(400).json({
        success: false,
        message: 'ID питання обов\'язкове',
      });
    }

    // Отримуємо питання з БД
    const question = await Question.findById(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Питання не знайдено',
      });
    }

    // Генеруємо відповідь через Gemini Pro
    const result = await aiService.generateAnswerSuggestion(
      question.title,
      question.body,
      question.tags
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Помилка генерації відповіді',
        error: result.error || 'Невідома помилка',
      });
    }

    res.json({
      success: true,
      data: {
        suggestion: result.suggestion,
        model: result.model,
        questionId,
      },
    });
  } catch (error) {
    console.error('AI Suggest Answer Error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера',
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/suggest-tags
 * Пропонує теги для питання
 * Публічний ендпоінт
 */
router.post('/suggest-tags', async (req, res) => {
  try {
    const { title, body } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Заголовок та текст питання обов\'язкові',
      });
    }

    // Генеруємо теги через Gemini Flash
    const result = await aiService.suggestTags(title, body);

    res.json({
      success: true,
      data: {
        tags: result.tags,
        model: result.model,
      },
    });
  } catch (error) {
    console.error('AI Suggest Tags Error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка генерації тегів',
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/moderate
 * Модерує контент через AI
 * Використовується внутрішньо або адмінами
 */
router.post('/moderate', authenticateToken, async (req, res) => {
  try {
    const { text, type } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Текст для модерації обов\'язковий',
      });
    }

    // Модеруємо контент через Gemini Flash
    const result = await aiService.moderateContent(text, type || 'question');

    res.json({
      success: true,
      data: {
        status: result.status,
        isAcceptable: result.isAcceptable,
        model: result.model,
      },
    });
  } catch (error) {
    console.error('AI Moderation Error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка модерації',
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/summarize
 * Створює резюме для довгого питання
 * Публічний ендпоінт
 */
router.post('/summarize', async (req, res) => {
  try {
    const { questionId } = req.body;

    if (!questionId) {
      return res.status(400).json({
        success: false,
        message: 'ID питання обов\'язкове',
      });
    }

    // Отримуємо питання з БД
    const question = await Question.findById(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Питання не знайдено',
      });
    }

    // Генеруємо резюме через Gemini Flash
    const result = await aiService.summarizeQuestion(
      question.title,
      question.body
    );

    res.json({
      success: true,
      data: {
        needsSummary: result.needsSummary,
        summary: result.summary,
        model: result.model,
      },
    });
  } catch (error) {
    console.error('AI Summarization Error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка створення резюме',
      error: error.message,
    });
  }
});

/**
 * GET /api/ai/similar-questions/:questionId
 * Знаходить схожі питання
 * Публічний ендпоінт
 */
router.get('/similar-questions/:questionId', async (req, res) => {
  try {
    const { questionId } = req.params;
    const qid = parseInt(questionId, 10);

    if (isAiDisabled()) {
      return res.json({
        success: true,
        data: {
          similarQuestions: [],
          model: null,
          aiDisabled: true,
        },
      });
    }

    const cached = cacheSimilarGet(qid);
    if (cached) {
      return res.json({
        success: true,
        data: {
          ...cached,
          cached: true,
        },
      });
    }

    // Отримуємо питання з БД
    const question = await Question.findById(qid);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Питання не знайдено',
      });
    }

    // Отримуємо всі питання для порівняння (останні 50)
    const allQuestions = await Question.list({
      page: 1,
      limit: 50,
      sortBy: 'created_at',
    });

    // Фільтруємо поточне питання
    const questionsToCompare = allQuestions.questions.filter((q) => q.id !== qid);

    // Шукаємо схожі через Gemini Flash
    const result = await aiService.findSimilarQuestions(
      question.title,
      question.body,
      questionsToCompare
    );

    const data = {
      similarQuestions: result.similarQuestions || [],
      model: result.model || null,
    };

    cacheSimilarSet(qid, data, { isError: !result.success });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    if (isGeminiQuotaOrRateLimitError(error)) {
      if (process.env.AI_DEBUG === '1') {
        console.warn('[AI] similar-questions route:', String(error.message).slice(0, 160));
      }
    } else {
      console.error('AI Similar Questions route error:', error);
    }
    res.status(500).json({
      success: false,
      message: 'Помилка пошуку схожих питань',
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/summarize-answers
 * Резюме дискусії (відповідей)
 */
router.post('/summarize-answers', async (req, res) => {
  try {
    if (isAiDisabled()) {
      return res.json({ success: true, data: { needsSummary: false, summary: null, aiDisabled: true } });
    }

    const { questionId } = req.body;
    if (!questionId) {
      return res.status(400).json({ success: false, message: 'ID питання обов\'язкове' });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Питання не знайдено' });
    }

    const qid = parseInt(questionId, 10);
    const answers = await Answer.listByQuestion(qid, { sortBy: 'votes' });
    const result = await aiService.summarizeAnswers(question.title, answers);

    res.json({
      success: true,
      data: {
        needsSummary: result.needsSummary,
        summary: result.summary,
        answerCount: result.answerCount ?? answers.length,
        model: result.model,
      },
    });
  } catch (error) {
    console.error('AI Summarize Answers Error:', error);
    res.status(500).json({ success: false, message: 'Помилка резюме відповідей', error: error.message });
  }
});

/**
 * GET /api/ai/related-content/:questionId
 * Рекомендації пов'язаних матеріалів хабу
 */
router.get('/related-content/:questionId', async (req, res) => {
  try {
    if (isAiDisabled()) {
      return res.json({ success: true, data: { related: [], aiDisabled: true } });
    }

    const qid = parseInt(req.params.questionId, 10);
    const question = await Question.findById(qid);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Питання не знайдено' });
    }

    const catalog = (await loadHubCatalog(10)).filter(
      (c) => !(c.type === CONTENT_TYPES.QUESTION && c.id === qid),
    );

    const result = await aiService.findRelatedContent(
      question.title,
      question.body,
      question.tags,
      catalog,
    );

    res.json({
      success: true,
      data: {
        related: result.related || [],
        model: result.model,
      },
    });
  } catch (error) {
    console.error('AI Related Content Error:', error);
    res.status(500).json({ success: false, message: 'Помилка рекомендацій', error: error.message });
  }
});

/**
 * POST /api/ai/check-duplicate
 * Перевірка дублікатів перед публікацією
 */
router.post('/check-duplicate', async (req, res) => {
  try {
    if (isAiDisabled()) {
      return res.json({
        success: true,
        data: { duplicateCount: 0, duplicates: [], message: null, aiDisabled: true },
      });
    }

    const { title, body, excludeQuestionId } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Заголовок обов\'язковий' });
    }

    const all = await Question.list({ page: 1, limit: 60, sortBy: 'created_at' });
    const excludeId = excludeQuestionId ? parseInt(excludeQuestionId, 10) : null;
    const candidates = all.questions.filter((q) => q.id !== excludeId);

    const result = await aiService.checkDuplicateQuestions(title.trim(), body || '', candidates);

    res.json({
      success: true,
      data: {
        duplicateCount: result.duplicateCount,
        duplicates: result.duplicates,
        message: result.message,
        model: result.model,
      },
    });
  } catch (error) {
    console.error('AI Check Duplicate Error:', error);
    res.status(500).json({ success: false, message: 'Помилка перевірки дублікатів', error: error.message });
  }
});

/**
 * POST /api/ai/analyze-question
 * Аналіз якості формулювання
 */
router.post('/analyze-question', async (req, res) => {
  try {
    if (isAiDisabled()) {
      return res.json({
        success: true,
        data: { score: null, verdict: 'unknown', aiDisabled: true },
      });
    }

    const { title, body } = req.body;
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Заголовок і текст питання обов\'язкові',
      });
    }

    const result = await aiService.analyzeQuestionQuality(title.trim(), body.trim());

    res.json({
      success: true,
      data: {
        score: result.score,
        verdict: result.verdict,
        issues: result.issues,
        improvedTitle: result.improvedTitle,
        improvedBodyIntro: result.improvedBodyIntro,
        tips: result.tips,
        model: result.model,
      },
    });
  } catch (error) {
    console.error('AI Analyze Question Error:', error);
    res.status(500).json({ success: false, message: 'Помилка аналізу якості', error: error.message });
  }
});

/**
 * POST /api/ai/generate-roadmap
 * Генерація roadmap за стеком (авторизовані)
 */
router.post('/generate-roadmap', authenticateToken, async (req, res) => {
  try {
    if (isAiDisabled()) {
      return res.status(503).json({ success: false, message: 'AI вимкнено (AI_ENABLED=0)' });
    }

    const { stack, goal, level } = req.body;
    if (!stack?.trim()) {
      return res.status(400).json({ success: false, message: 'Вкажіть стек (технології)' });
    }

    const result = await aiService.generateRoadmap({
      stack: stack.trim(),
      goal: goal?.trim(),
      level: level || 'beginner',
    });

    if (!result.success || !result.roadmap?.steps?.length) {
      return res.status(500).json({
        success: false,
        message: 'Не вдалося згенерувати маршрут',
        error: result.error,
      });
    }

    res.json({
      success: true,
      data: {
        roadmap: result.roadmap,
        model: result.model,
      },
    });
  } catch (error) {
    console.error('AI Generate Roadmap Error:', error);
    res.status(500).json({ success: false, message: 'Помилка генерації roadmap', error: error.message });
  }
});

/**
 * GET /api/ai/status
 * Перевіряє доступність AI сервісу
 */
router.get('/status', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        available: true,
        models: {
          flash: flashModelId,
          pro: proModelId,
        },
        features: [
          'answer-suggestions',
          'auto-tagging',
          'content-moderation',
          'summarization',
          'similar-questions',
          'answers-summary',
          'related-content',
          'duplicate-detection',
          'question-quality',
          'roadmap-generation',
          'challenge-scoring',
        ],
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'AI сервіс недоступний',
      error: error.message,
    });
  }
});

export default router;
