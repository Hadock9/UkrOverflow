/**
 * Парсинг JSON-відповідей Gemini (з або без markdown-огорожі).
 */
export function parseGeminiJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Порожня відповідь моделі');
  }
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : trimmed;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    const arrStart = raw.indexOf('[');
    const arrEnd = raw.lastIndexOf(']');
    if (arrStart >= 0 && arrEnd > arrStart) {
      return JSON.parse(raw.slice(arrStart, arrEnd + 1));
    }
    throw new Error('Модель повернула невалідний JSON');
  }
}
