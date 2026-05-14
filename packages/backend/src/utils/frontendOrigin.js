/**
 * FRONTEND_URL може містити кілька origin через кому (різні способи доступу до сайту).
 */

/**
 * Прибирає подвійні схеми після типової помилки копіпасти (https://https://host).
 */
export function sanitizeHttpUrlDuplicates(value) {
  let t = String(value ?? '').trim().replace(/\s+/g, '');
  if (!t) return '';
  while (/^https?:\/\/https?:\/\//i.test(t)) {
    t = t.replace(/^https?:\/\//i, '');
  }
  return t;
}

export function parseFrontendOrigins() {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => sanitizeHttpUrlDuplicates(s.trim()))
    .filter(Boolean)
    .map((s) => s.replace(/\/$/, ''));
}

export function primaryFrontendOrigin() {
  const list = parseFrontendOrigins();
  return list[0] || 'http://localhost:5173';
}

/**
 * Для GitHub OAuth потрібен один точний redirect_uri.
 * Якщо у FRONTEND_URL кілька origin без GITHUB_CALLBACK_URL — не беремо сліпо перший
 * (часто там IP по http), а пріоритизуємо https і звичайне ім’я хоста.
 */
export function pickOriginForGithubOAuthCallback(origins) {
  if (!origins?.length) return null;
  const list = origins.map((o) => o.replace(/\/$/, ''));
  if (list.length === 1) return list[0];

  const tryParse = (raw) => {
    try {
      return new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    } catch {
      return null;
    }
  };

  const isIpLiteral = (hostname) =>
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':');

  for (const raw of list) {
    const u = tryParse(raw);
    if (u && u.protocol === 'https:' && !isIpLiteral(u.hostname)) return raw;
  }
  for (const raw of list) {
    const u = tryParse(raw);
    if (u && u.protocol === 'https:') return raw;
  }
  for (const raw of list) {
    const u = tryParse(raw);
    if (u && !isIpLiteral(u.hostname)) return raw;
  }
  return list[0];
}

/**
 * Базовий URL фронта для редіректів після OAuth тощо:
 * підбираємо origin із whitelist за Host / Referer, інакше — перший із FRONTEND_URL.
 */
export function resolveFrontendBaseUrl(req) {
  const allowed = parseFrontendOrigins();
  const fallback = primaryFrontendOrigin();

  if (!req || allowed.length === 0) return fallback;

  const forwardedProto = (req.get('X-Forwarded-Proto') || '').split(',')[0]?.trim();
  const proto = forwardedProto || req.protocol || 'http';
  const forwardedHost = (req.get('X-Forwarded-Host') || '').split(',')[0]?.trim();
  const hostHeader = forwardedHost || req.get('Host') || '';

  if (hostHeader) {
    const hostLower = hostHeader.toLowerCase().split(':')[0];
    const candidates = [`${proto}://${hostHeader}`.replace(/\/$/, '')];
    if (proto === 'http') candidates.push(`https://${hostHeader}`.replace(/\/$/, ''));

    for (const c of candidates) {
      const norm = c.replace(/\/$/, '');
      if (allowed.includes(norm)) return norm;
    }

    for (const origin of allowed) {
      try {
        const u = new URL(origin.startsWith('http') ? origin : `http://${origin}`);
        if (u.hostname.toLowerCase() === hostLower) return origin.replace(/\/$/, '');
      } catch {
        continue;
      }
    }
  }

  const referer = req.get('Referer');
  if (referer) {
    try {
      const u = new URL(referer);
      const base = `${u.protocol}//${u.host}`.replace(/\/$/, '');
      if (allowed.includes(base)) return base;
    } catch {
      /* ignore */
    }
  }

  return fallback;
}
