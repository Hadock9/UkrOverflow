import express from 'express';
import aiService from '../services/aiService.js';
import { authenticateToken } from '../middleware/auth.js';
import { Question } from '../models/Question.js';
import { flashModelId, proModelId } from '../config/gemini.js';

const router = express.Router();

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

    // Отримуємо питання з БД
    const question = await Question.findById(questionId);

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
    const questionsToCompare = allQuestions.questions.filter(
      q => q.id !== parseInt(questionId)
    );

    // Шукаємо схожі через Gemini Flash
    const result = await aiService.findSimilarQuestions(
      question.title,
      question.body,
      questionsToCompare
    );

    res.json({
      success: true,
      data: {
        similarQuestions: result.similarQuestions,
        model: result.model,
      },
    });
  } catch (error) {
    console.error('AI Similar Questions Error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка пошуку схожих питань',
      error: error.message,
    });
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
