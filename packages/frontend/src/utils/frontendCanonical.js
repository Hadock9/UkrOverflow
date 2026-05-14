/**
 * Канонічний публічний URL фронта з build-time env (Docker / Vite).
 */

function sanitizeUrlSchemeDupes(value) {
  let t = String(value ?? '').trim().replace(/\s+/g, '');
  if (!t) return '';
  while (/^https?:\/\/https?:\/\//i.test(t)) {
    t = t.replace(/^https?:\/\//i, '');
  }
  return t;
}

/**
 * Якщо задано VITE_FRONTEND_CANONICAL_ORIGIN і він не збігається з поточним origin —
 * перенаправляє браузер (повне завантаження), щоб після входу був HTTPS-домен, а не IP.
 *
 * @param {string} path — шлях від кореня SPA, за замовчуванням /
 * @returns {boolean} true, якщо виконано window.location.replace
 */
export function redirectToCanonicalPath(path = '/') {
  const raw = sanitizeUrlSchemeDupes(import.meta.env.VITE_FRONTEND_CANONICAL_ORIGIN);
  if (!raw) return false;
  const base = raw.replace(/\/$/, '');
  if (!/^https?:\/\//i.test(base)) return false;

  let canonOrigin;
  try {
    canonOrigin = new URL(base).origin;
  } catch {
    return false;
  }

  const p = typeof path === 'string' && path.startsWith('/') ? path : `/${path || ''}`;

  if (canonOrigin === window.location.origin) return false;

  window.location.replace(`${canonOrigin}${p}`);
  return true;
}
