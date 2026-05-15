import {
  safetySettings,
  flashModelId,
  proModelId,
  flashGenerationConfig,
  proGenerationConfig,
} from '../config/gemini.js';
import { geminiGenerateContent, textFromGeminiResponse } from '../config/geminiRestClient.js';
import { isGeminiQuotaOrRateLimitError } from '../utils/geminiErrors.js';
import { parseGeminiJson } from '../utils/aiJson.js';

/** Детальніший текст для помилок (Node 18+ інкладки в error.cause) */
function describeGeminiError(err) {
  if (!err) return 'Невідома помилка';
  const parts = [err.message];
  if (err.cause) {
    parts.push(err.cause instanceof Error ? err.cause.message : String(err.cause));
  }
  return parts.filter(Boolean).join(' | ');
}

function normalizeQuestionTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map(String).filter(Boolean);
  }
  if (tags == null) {
    return [];
  }
  if (typeof tags === 'string') {
    const t = tags.trim();
    if (!t) return [];
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(Boolean);
      }
    } catch {
      /* не JSON */
    }
    return t.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

class AIService {

  /**
   * 1. AI-підказка відповіді: за замовчуванням лише Flash (free tier без Pro).
   * Увімкнути спробу Pro: AI_USE_PRO=1 у .env (потрібна квота на Pro).
   */
  async generateAnswerSuggestion(questionTitle, questionBody, tags) {
    const tagList = normalizeQuestionTags(tags);
    const prompt = `Ти експерт з програмування. Допоможи згенерувати відповідь на це питання українською мовою.

ПИТАННЯ: ${questionTitle}

ДЕТАЛІ:
${questionBody}

ТЕГИ: ${tagList.length ? tagList.join(', ') : '—'}

Створи детальну, структуровану відповідь з:
1. Поясненням проблеми
2. Покроковим рішенням
3. Прикладом коду (якщо потрібно)
4. Порадами щодо best practices

Використовуй Markdown форматування. Відповідь має бути корисною, професійною та зрозумілою.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const baseBody = { contents, safetySettings };

    const usePro =
      process.env.AI_USE_PRO === '1' ||
      process.env.AI_USE_PRO === 'true';

    const attempts =
      usePro && proModelId !== flashModelId
        ? [
            { id: proModelId, config: proGenerationConfig },
            { id: flashModelId, config: flashGenerationConfig },
          ]
        : [{ id: flashModelId, config: flashGenerationConfig }];

    let lastError;
    for (const { id, config } of attempts) {
      try {
        const json = await geminiGenerateContent({
          model: id,
          body: { ...baseBody, generationConfig: config },
        });
        const suggestion = textFromGeminiResponse(json);
        if (!suggestion?.trim()) {
          lastError = new Error('Модель повернула порожній текст');
          continue;
        }
        return {
          success: true,
          suggestion,
          model: id,
        };
      } catch (error) {
        lastError = error;
        if (isGeminiQuotaOrRateLimitError(error)) {
          if (process.env.AI_DEBUG === '1') {
            console.warn(`[AI] answer (${id}): квота/ліміт —`, String(error.message).slice(0, 140));
          }
        } else {
          console.error(`AI Answer Generation (${id}):`, describeGeminiError(error));
        }
      }
    }

    return {
      success: false,
      error: describeGeminiError(lastError) || 'Невідома помилка Gemini',
    };
  }

  /**
   * 2. AUTO-TAGGING ПИТАНЬ (Gemini Flash)
   */
  async suggestTags(questionTitle, questionBody) {
    try {
      const prompt = `Проаналізуй це питання про програмування та запропонуй 3-5 найбільш релевантних тегів.

ЗАГОЛОВОК: ${questionTitle}

ТЕКСТ:
${questionBody}

Поверни ТІЛЬКИ список тегів через кому (малими літерами, англійською або українською).
Приклад: javascript, react, hooks, async, api

Теги:`;

      const json = await geminiGenerateContent({
        model: flashModelId,
        body: {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          safetySettings,
          generationConfig: flashGenerationConfig,
        },
      });

      const response = textFromGeminiResponse(json);
      const tags = response
        .trim()
        .toLowerCase()
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0 && tag.length < 30)
        .slice(0, 5);

      return {
        success: true,
        tags,
        model: flashModelId,
      };
    } catch (error) {
      if (isGeminiQuotaOrRateLimitError(error)) {
        if (process.env.AI_DEBUG === '1') {
          console.warn('[AI] tags: квота/ліміт —', String(error.message).slice(0, 140));
        }
      } else {
        console.error('AI Tag Suggestion Error:', describeGeminiError(error));
      }
      return {
        success: false,
        error: describeGeminiError(error),
        tags: [],
      };
    }
  }

  /**
   * 3. МОДЕРАЦІЯ КОНТЕНТУ (Gemini Flash)
   */
  async moderateContent(text, type = 'question') {
    try {
      const prompt = `Ти модератор української Q&A платформи для програмістів. Проаналізуй цей ${type === 'question' ? 'текст питання' : 'текст відповіді'}:

"${text}"

Визнач чи є це:
1. SPAM (реклама, непов'язане з програмуванням)
2. TOXIC (образи, грубість, hate speech)
3. LOW_QUALITY (занадто коротко, незрозуміло, без деталей)
4. OK (нормальний контент)

Поверни ТІЛЬКИ одне слово: SPAM, TOXIC, LOW_QUALITY або OK`;

      const json = await geminiGenerateContent({
        model: flashModelId,
        body: {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          safetySettings,
          generationConfig: flashGenerationConfig,
        },
      });

      const response = textFromGeminiResponse(json).trim().toUpperCase();
      const status = ['SPAM', 'TOXIC', 'LOW_QUALITY', 'OK'].includes(response)
        ? response
        : 'OK';

      return {
        success: true,
        status,
        isAcceptable: status === 'OK',
        model: flashModelId,
      };
    } catch (error) {
      if (isGeminiQuotaOrRateLimitError(error)) {
        if (process.env.AI_DEBUG === '1') {
          console.warn('[AI] moderate: квота/ліміт —', String(error.message).slice(0, 140));
        }
      } else {
        console.error('AI Moderation Error:', describeGeminiError(error));
      }
      return {
        success: false,
        status: 'OK',
        isAcceptable: true,
        error: describeGeminiError(error),
      };
    }
  }

  /**
   * 4. SMART SUMMARIZATION (Gemini Flash)
   */
  async summarizeQuestion(questionTitle, questionBody) {
    try {
      if (questionBody.length < 500) {
        return {
          success: true,
          needsSummary: false,
          summary: null,
        };
      }

      const prompt = `Створи коротке резюме (TL;DR) цього питання українською мовою (максимум 2-3 речення):

ЗАГОЛОВОК: ${questionTitle}

ТЕКСТ:
${questionBody}

Резюме має бути коротким, інформативним та зрозумілим. Використовуй одне речення якщо можливо.

TL;DR:`;

      const json = await geminiGenerateContent({
        model: flashModelId,
        body: {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          safetySettings,
          generationConfig: flashGenerationConfig,
        },
      });

      const summary = textFromGeminiResponse(json).trim();

      return {
        success: true,
        needsSummary: true,
        summary,
        model: flashModelId,
      };
    } catch (error) {
      if (isGeminiQuotaOrRateLimitError(error)) {
        if (process.env.AI_DEBUG === '1') {
          console.warn('[AI] summarize: квота або ліміт Gemini —', String(error.message).slice(0, 160));
        }
      } else {
        console.error('AI Summarization Error:', describeGeminiError(error));
      }
      return {
        success: false,
        needsSummary: false,
        summary: null,
        error: describeGeminiError(error),
      };
    }
  }

  /**
   * 5. ПОШУК СХОЖИХ ПИТАНЬ (Gemini Flash)
   */
  async findSimilarQuestions(questionTitle, questionBody, allQuestions) {
    try {
      const questionsToAnalyze = allQuestions.slice(0, 50);

      const questionsText = questionsToAnalyze
        .map((q, idx) => `${idx + 1}. [ID:${q.id}] ${q.title}`)
        .join('\n');

      const prompt = `Ти помічник для пошуку схожих питань. Проаналізуй нове питання та знайди 3-5 найбільш схожих з списку.

НОВЕ ПИТАННЯ:
Заголовок: ${questionTitle}
Опис: ${questionBody.substring(0, 300)}...

СПИСОК ІСНУЮЧИХ ПИТАНЬ:
${questionsText}

Поверни ТІЛЬКИ ID схожих питань через кому (наприклад: 5,12,3). Якщо немає схожих, поверни "NONE".

ID:`;

      const json = await geminiGenerateContent({
        model: flashModelId,
        body: {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          safetySettings,
          generationConfig: flashGenerationConfig,
        },
      });

      const response = textFromGeminiResponse(json).trim();

      if (response === 'NONE' || !response) {
        return {
          success: true,
          similarQuestions: [],
          model: flashModelId,
        };
      }

      const similarIds = response
        .split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id));

      const similarQuestions = questionsToAnalyze.filter(q =>
        similarIds.includes(q.id)
      );

      return {
        success: true,
        similarQuestions,
        model: flashModelId,
      };
    } catch (error) {
      if (isGeminiQuotaOrRateLimitError(error)) {
        if (process.env.AI_DEBUG === '1') {
          console.warn('[AI] similar-questions: квота або ліміт Gemini —', String(error.message).slice(0, 160));
        }
      } else {
        console.error('AI Similar Questions Error:', describeGeminiError(error));
      }
      return {
        success: false,
        similarQuestions: [],
        error: describeGeminiError(error),
      };
    }
  }

  async _flashJsonPrompt(prompt, { maxOutputTokens } = {}) {
    const generationConfig = maxOutputTokens
      ? { ...flashGenerationConfig, maxOutputTokens }
      : flashGenerationConfig;
    const json = await geminiGenerateContent({
      model: flashModelId,
      body: {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        safetySettings,
        generationConfig,
      },
    });
    return parseGeminiJson(textFromGeminiResponse(json));
  }

  /**
   * 6. Резюме дискусії (відповіді на питання)
   */
  async summarizeAnswers(questionTitle, answers) {
    try {
      if (!answers?.length) {
        return { success: true, needsSummary: false, summary: null };
      }

      const thread = answers
        .slice(0, 12)
        .map((a, i) => {
          const body = (a.body || '').slice(0, 1200);
          const accepted = a.is_accepted ? ' [ПРИЙНЯТА]' : '';
          return `${i + 1}. ${a.author_name || 'Автор'}${accepted}:\n${body}`;
        })
        .join('\n\n');

      const prompt = `Ти аналітик Q&A платформи для розробників. Створи стисле резюме ДИСКУСІЇ українською (3–5 речень):
- які рішення запропоновані;
- чи є консенсус;
- що варто спробувати першим.

ПИТАННЯ: ${questionTitle}

ВІДПОВІДІ:
${thread}

Поверни ТІЛЬКИ текст резюме без заголовків.`;

      const json = await geminiGenerateContent({
        model: flashModelId,
        body: {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          safetySettings,
          generationConfig: flashGenerationConfig,
        },
      });

      const summary = textFromGeminiResponse(json).trim();
      return {
        success: true,
        needsSummary: Boolean(summary),
        summary,
        answerCount: answers.length,
        model: flashModelId,
      };
    } catch (error) {
      return {
        success: false,
        needsSummary: false,
        summary: null,
        error: describeGeminiError(error),
      };
    }
  }

  /**
   * 7. Рекомендації пов'язаного контенту (хаб)
   */
  async findRelatedContent(questionTitle, questionBody, tags, catalog) {
    try {
      const items = catalog.slice(0, 80);
      if (!items.length) {
        return { success: true, related: [], model: flashModelId };
      }

      const catalogText = items
        .map((c) => `${c.type}:${c.id} | ${c.title}`)
        .join('\n');

      const tagList = normalizeQuestionTags(tags);

      const prompt = `Підбери 3–6 найрелевантніших матеріалів з каталогу для читача цього питання.

ПИТАННЯ: ${questionTitle}
ОПИС: ${(questionBody || '').slice(0, 400)}
ТЕГИ: ${tagList.join(', ') || '—'}

КАТАЛОГ (type:id | title):
${catalogText}

Поверни JSON:
{
  "items": [
    { "type": "question|article|guide|snippet|roadmap|best_practice|faq", "id": 123, "reason": "коротко українською чому релевантно" }
  ]
}
Тільки id з каталогу. Якщо нічого не підходить — "items": [].`;

      const parsed = await this._flashJsonPrompt(prompt);
      const allowed = new Set(items.map((c) => `${c.type}:${c.id}`));
      const related = (parsed.items || [])
        .filter((row) => row?.type && row?.id != null && allowed.has(`${row.type}:${row.id}`))
        .slice(0, 6)
        .map((row) => {
          const hit = items.find((c) => c.type === row.type && c.id === Number(row.id));
          return hit
            ? { ...hit, reason: row.reason || '' }
            : null;
        })
        .filter(Boolean);

      return { success: true, related, model: flashModelId };
    } catch (error) {
      return { success: false, related: [], error: describeGeminiError(error) };
    }
  }

  /**
   * 8. Дублікати / дуже схожі питання (перед публікацією)
   */
  async checkDuplicateQuestions(title, body, candidates) {
    try {
      const pool = candidates.slice(0, 60);
      if (!pool.length || !title?.trim()) {
        return {
          success: true,
          duplicateCount: 0,
          duplicates: [],
          message: null,
          model: flashModelId,
        };
      }

      const listText = pool.map((q) => `question:${q.id} | ${q.title}`).join('\n');

      const prompt = `Чи є серед існуючих питань ДУБЛІКАТИ або дуже близькі теми до нового?

НОВЕ ПИТАННЯ:
Заголовок: ${title}
Текст: ${(body || '').slice(0, 500)}

СПИСОК:
${listText}

Поверни JSON:
{
  "duplicates": [
    { "id": 12, "similarity": "high|medium", "reason": "чому схоже" }
  ]
}
high = майже те саме питання. Максимум 8. Якщо немає — [].`;

      const parsed = await this._flashJsonPrompt(prompt);
      const idSet = new Set(pool.map((q) => q.id));
      const duplicates = (parsed.duplicates || [])
        .filter((d) => idSet.has(Number(d.id)))
        .slice(0, 8)
        .map((d) => {
          const q = pool.find((x) => x.id === Number(d.id));
          return q
            ? {
                id: q.id,
                title: q.title,
                type: 'question',
                similarity: d.similarity || 'medium',
                reason: d.reason || '',
              }
            : null;
        })
        .filter(Boolean);

      const duplicateCount = duplicates.length;
      const message = duplicateCount > 0
        ? `Твоє питання схоже на ${duplicateCount} вже існуюч${duplicateCount === 1 ? 'е' : duplicateCount < 5 ? 'і' : 'их'}`
        : null;

      return {
        success: true,
        duplicateCount,
        duplicates,
        message,
        model: flashModelId,
      };
    } catch (error) {
      return {
        success: false,
        duplicateCount: 0,
        duplicates: [],
        message: null,
        error: describeGeminiError(error),
      };
    }
  }

  /**
   * 9. Якість формулювання питання
   */
  async analyzeQuestionQuality(title, body) {
    try {
      const prompt = `Оціни якість питання на українській Q&A платформі для програмістів.

ЗАГОЛОВОК: ${title}
ТЕКСТ:
${(body || '').slice(0, 3000)}

Поверни JSON:
{
  "score": 1-10,
  "verdict": "good|needs_improvement",
  "issues": ["проблема 1", "проблема 2"],
  "improvedTitle": "покращений заголовок",
  "improvedBodyIntro": "1-2 речення як краще почати опис",
  "tips": ["порада 1", "порада 2"]
}
Будь конструктивним. improvedTitle/improvedBodyIntro — лише якщо verdict needs_improvement.`;

      const parsed = await this._flashJsonPrompt(prompt);
      const score = Math.min(10, Math.max(1, Number(parsed.score) || 5));
      const verdict = parsed.verdict === 'good' ? 'good' : 'needs_improvement';

      return {
        success: true,
        score,
        verdict,
        issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 6) : [],
        improvedTitle: parsed.improvedTitle || null,
        improvedBodyIntro: parsed.improvedBodyIntro || null,
        tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 5) : [],
        model: flashModelId,
      };
    } catch (error) {
      return {
        success: false,
        score: null,
        verdict: 'unknown',
        issues: [],
        error: describeGeminiError(error),
      };
    }
  }

  /**
   * 10. Генерація навчального roadmap за стеком
   */
  async generateRoadmap({ stack, goal, level = 'beginner' }) {
    try {
      const prompt = `Створи навчальний roadmap українською для розробника.

СТЕК / ТЕХНОЛОГІЇ: ${stack}
ЦІЛЬ: ${goal || 'стати впевненим junior/middle у цьому стеку'}
РІВЕНЬ: ${level}

Поверни JSON:
{
  "title": "назва маршруту",
  "summary": "2-3 речення",
  "body": "вступ markdown (до 400 слів)",
  "difficulty": "beginner|intermediate|advanced",
  "estimated_weeks": 12,
  "tags": ["tag1", "tag2"],
  "steps": [
    { "order": 1, "title": "етап", "description": "що вивчити і зробити", "estimated_weeks": 2 }
  ]
}
Мінімум 5 кроків, максимум 10.`;

      const parsed = await this._flashJsonPrompt(prompt, { maxOutputTokens: 4096 });
      const steps = (parsed.steps || [])
        .slice(0, 10)
        .map((s, i) => ({
          order: s.order ?? i + 1,
          title: String(s.title || `Етап ${i + 1}`).slice(0, 200),
          description: String(s.description || '').slice(0, 2000),
          estimated_weeks: Math.min(52, Math.max(1, Number(s.estimated_weeks) || 1)),
        }));

      return {
        success: true,
        roadmap: {
          title: String(parsed.title || `Roadmap: ${stack}`).slice(0, 255),
          summary: String(parsed.summary || '').slice(0, 500),
          body: String(parsed.body || '').slice(0, 12000),
          difficulty: ['beginner', 'intermediate', 'advanced'].includes(parsed.difficulty)
            ? parsed.difficulty
            : level,
          estimated_weeks: Math.min(104, Math.max(1, Number(parsed.estimated_weeks) || 8)),
          tags: (parsed.tags || []).map((t) => String(t).toLowerCase().slice(0, 30)).slice(0, 8),
          steps: steps.length >= 3 ? steps : [],
        },
        model: flashModelId,
      };
    } catch (error) {
      return { success: false, error: describeGeminiError(error) };
    }
  }
}

export default new AIService();
