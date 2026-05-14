/**
 * FRONTEND_URL може містити кілька origin через кому (різні способи доступу до сайту).
 */

export function parseFrontendOrigins() {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\/$/, ''));
}

export function primaryFrontendOrigin() {
  const list = parseFrontendOrigins();
  return list[0] || 'http://localhost:5173';
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
