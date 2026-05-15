/**
 * Безпечний LIMIT для SQL (mysql2 не завжди коректно біндить LIMIT ?).
 */
export function sqlLimit(value, defaultVal = 10, max = 100) {
  const n = parseInt(String(value ?? defaultVal), 10);
  if (!Number.isFinite(n) || n < 1) return defaultVal;
  return Math.min(max, n);
}
