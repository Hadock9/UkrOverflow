/**
 * Класифікація помилок Gemini (квота / rate limit — очікувані в dev).
 */

export function isGeminiQuotaOrRateLimitError(err) {
  const m = String(err?.message ?? err ?? '');
  return /quota exceeded|exceeded your current quota|resource_exhausted|rate limit|free_tier|429\b|Too Many Requests/i.test(
    m
  );
}
