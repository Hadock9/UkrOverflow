import {
  safetySettings,
  flashModelId,
  proModelId,
  flashGenerationConfig,
  proGenerationConfig,
} from '../config/gemini.js';
import { geminiGenerateContent, textFromGeminiResponse } from '../config/geminiRestClient.js';

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
   * 1. AI-ПОМІЧНИК ДЛЯ ГЕНЕРАЦІЇ ВІДПОВІДЕЙ (спочатку Pro, потім Flash)
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

    const attempts = [
      { id: proModelId, config: proGenerationConfig },
      ...(flashModelId !== proModelId
        ? [{ id: flashModelId, config: flashGenerationConfig }]
        : []),
    ];

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
        console.error(`AI Answer Generation (${id}):`, describeGeminiError(error));
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
      console.error('AI Tag Suggestion Error:', error);
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
      console.error('AI Moderation Error:', error);
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
      console.error('AI Summarization Error:', error);
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
      console.error('AI Similar Questions Error:', error);
      return {
        success: false,
        similarQuestions: [],
        error: describeGeminiError(error),
      };
    }
  }
}

export default new AIService();
