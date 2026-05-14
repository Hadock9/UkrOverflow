/**
 * GitHub API клієнт.
 *
 * Реалізація на вбудованому fetch (Node 18+). Без сторонніх залежностей.
 * Документація: https://docs.github.com/en/rest
 *
 * Очікувані env (обов’язково для вмикання OAuth):
 *   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
 * Callback URL для GitHub App повинен збігатися з тим, що повертає
 * resolveGithubCallbackUrlFromRequest(req) — GITHUB_CALLBACK_URL, GITHUB_OAUTH_PUBLIC_ORIGIN,
 * або GITHUB_OAUTH_REDIRECT_URI (повний URL 1:1 як у GitHub OAuth App — найнадійніше).
 *
 * На сторінці OAuth App поля Homepage / Authorization callback — завжди з http:// або https://.
 */

import {
  parseFrontendOrigins,
  pickOriginForGithubOAuthCallback,
  sanitizeHttpUrlDuplicates,
} from '../utils/frontendOrigin.js';

function readGithubOAuthEnvUrl(envKey) {
  return sanitizeHttpUrlDuplicates(process.env[envKey]);
}

const GITHUB_API = 'https://api.github.com';
const GITHUB_OAUTH = 'https://github.com/login/oauth';
const USER_AGENT = 'DevFlow-Knowledge-Hub/1.0';

/**
 * GitHub порівнює redirect_uri з Authorization callback URL побайтово (після декодування).
 * Прибираємо пробіли й зайві слеші в кінці шляху.
 */
export function normalizeGithubRedirectUri(raw) {
  const s = String(raw ?? '').trim().replace(/\s+/g, '');
  if (!s) return s;
  try {
    const u = new URL(s);
    let p = u.pathname;
    while (p.length > 1 && p.endsWith('/')) {
      p = p.slice(0, -1);
    }
    u.pathname = p;
    return u.toString();
  } catch {
    return s.replace(/\/+$/, '');
  }
}

function finalizeRedirectUri(candidate) {
  return normalizeGithubRedirectUri(candidate);
}

function isBareIpv4(hostname) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

/**
 * Host / X-Forwarded-Host → лише hostname (без порту).
 * Підтримує [IPv6]:port, звичайний домен із :port та IPv4 з портом (не розбивати лише перший ':').
 */
function hostWithoutPort(headerValue) {
  const raw = String(headerValue ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']');
    return end > 1 ? raw.slice(1, end) : '';
  }
  const idx = raw.lastIndexOf(':');
  if (idx !== -1) {
    const after = raw.slice(idx + 1);
    if (/^\d+$/.test(after)) {
      return raw.slice(0, idx);
    }
  }
  return raw;
}

/** Куди підміняти IPv4-callback: явний домен або вибір із FRONTEND_URL. */
function resolveCanonicalOAuthOrigin(allowed) {
  const forced = readGithubOAuthEnvUrl('GITHUB_OAUTH_PUBLIC_ORIGIN');
  if (forced) {
    const raw = forced.replace(/\/$/, '');
    try {
      const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
      if (u.protocol === 'https:' && !isBareIpv4(u.hostname)) return raw;
    } catch {
      /* ignore */
    }
  }
  if (!allowed?.length) return null;
  const canonical = pickOriginForGithubOAuthCallback(allowed) ?? allowed[0];
  try {
    const u = new URL(canonical.startsWith('http') ? canonical : `https://${canonical}`);
    if (u.protocol === 'https:' && !isBareIpv4(u.hostname)) return canonical.replace(/\/$/, '');
    if (!isBareIpv4(u.hostname)) return canonical.replace(/\/$/, '');
  } catch {
    return canonical.replace(/\/$/, '');
  }
  return canonical.replace(/\/$/, '');
}

/** Якщо callback на голий IPv4, а є канонічний https-домен — підміняємо (узгоджено з OAuth App на GitHub). */
function coerceAwayFromIpv4LiteralCallback(candidateUrl, allowed) {
  if (!candidateUrl) return finalizeRedirectUri(candidateUrl);
  try {
    const fin = finalizeRedirectUri(candidateUrl);
    const u = new URL(fin);
    if (!isBareIpv4(u.hostname)) return fin;

    const canonical = resolveCanonicalOAuthOrigin(allowed);
    if (!canonical) return fin;

    let canonUrl;
    try {
      canonUrl = new URL(canonical.startsWith('http') ? canonical : `https://${canonical}`);
    } catch {
      return fin;
    }
    if (isBareIpv4(canonUrl.hostname)) return fin;

    const httpsBase = `https://${canonUrl.host}`;
    console.warn(
      '[GitHub OAuth] Callback був на IPv4 — замінено на канонічний https-домен. Задайте GITHUB_CALLBACK_URL або GITHUB_OAUTH_PUBLIC_ORIGIN і приберіть IP з .env.'
    );
    return finalizeRedirectUri(`${httpsBase.replace(/\/$/, '')}/api/auth/github/callback`);
  } catch {
    return finalizeRedirectUri(candidateUrl);
  }
}

/**
 * Якщо запит прийшов з Host, що збігається з одним із origin у FRONTEND_URL —
 * побудуємо відповідний redirect_uri без жорсткого відсікання голого IPv4.
 */
function githubCallbackFromRequestHost(req, allowed) {
  if (!req || !allowed.length) return null;

  const forwardedProto = (req.get('X-Forwarded-Proto') || '').split(',')[0]?.trim();
  const proto = forwardedProto || (req.protocol === 'https' ? 'https' : 'http');
  const forwardedHost = (req.get('X-Forwarded-Host') || '').split(',')[0]?.trim();
  const hostHeader = forwardedHost || req.get('Host') || '';
  if (!hostHeader) return null;

  const hostname = hostWithoutPort(hostHeader).toLowerCase();

  const candidates = [`${proto}://${hostHeader}`.replace(/\/$/, '')];
  if (proto === 'http') candidates.push(`https://${hostHeader}`.replace(/\/$/, ''));

  for (const base of candidates) {
    const norm = base.replace(/\/$/, '');
    if (allowed.includes(norm)) return `${norm}/api/auth/github/callback`;
  }

  if (!hostname) return null;

  for (const origin of allowed) {
    try {
      const u = new URL(origin.startsWith('http') ? origin : `http://${origin}`);
      if (u.hostname.toLowerCase() === hostname) {
        return `${origin.replace(/\/$/, '')}/api/auth/github/callback`;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/** У продакшені GitHub очікує https на публічному домені; http:// той самий host — відхиляється. */
function upgradeHttpDomainGithubCallbackToHttps(urlStr) {
  if (process.env.NODE_ENV === 'development') return urlStr;
  try {
    const fin = finalizeRedirectUri(urlStr);
    const u = new URL(fin);
    if (u.protocol !== 'http:') return fin;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1') return fin;
    if (isBareIpv4(h)) return fin;
    console.warn(
      '[GitHub OAuth] redirect_uri був http:// на домені — перемикаємо на https:// (узгодження з OAuth App на GitHub).'
    );
    return finalizeRedirectUri(`https://${u.host}${u.pathname}${u.search}`);
  } catch {
    return urlStr;
  }
}

/** Якщо лишився http:// (часто IP або localhost у проді), підміняємо на https://… з GITHUB_OAUTH_PUBLIC_ORIGIN. */
function forceHttpsGithubCallbackUsingPublicOriginIfStillHttp(urlStr) {
  const pub = readGithubOAuthEnvUrl('GITHUB_OAUTH_PUBLIC_ORIGIN').replace(/\/$/, '');
  if (!pub || process.env.NODE_ENV === 'development') return urlStr;
  try {
    const fin = finalizeRedirectUri(urlStr);
    const u = new URL(fin);
    if (u.protocol === 'https:') return fin;
    const bu = new URL(pub.startsWith('http') ? pub : `https://${pub}`);
    const httpsOrigin = `https://${bu.host}`;
    console.warn('[GitHub OAuth] redirect_uri зведено до https через GITHUB_OAUTH_PUBLIC_ORIGIN');
    return finalizeRedirectUri(`${httpsOrigin}/api/auth/github/callback`);
  } catch {
    return urlStr;
  }
}

function ensureProductionGithubRedirectUsesHttps(urlStr) {
  return forceHttpsGithubCallbackUsingPublicOriginIfStillHttp(
    upgradeHttpDomainGithubCallbackToHttps(urlStr)
  );
}

/**
 * Callback URL для GitHub OAuth з урахуванням запиту (authorize і token exchange мають бути однакові).
 * @param {import('express').Request | null | undefined} req
 */
export function resolveGithubCallbackUrlFromRequest(req) {
  const strictFull = readGithubOAuthEnvUrl('GITHUB_OAUTH_REDIRECT_URI');
  if (strictFull) {
    return ensureProductionGithubRedirectUsesHttps(finalizeRedirectUri(strictFull));
  }

  const allowed = parseFrontendOrigins();

  let resolved;

  const explicit = readGithubOAuthEnvUrl('GITHUB_CALLBACK_URL');
  if (explicit) {
    resolved = coerceAwayFromIpv4LiteralCallback(explicit, allowed);
  } else if (readGithubOAuthEnvUrl('PUBLIC_API_URL')) {
    const publicApi = readGithubOAuthEnvUrl('PUBLIC_API_URL');
    resolved = coerceAwayFromIpv4LiteralCallback(
      `${publicApi.replace(/\/$/, '')}/api/auth/github/callback`,
      allowed
    );
  } else if (process.env.NODE_ENV === 'development') {
    const port = process.env.API_PORT || '3338';
    resolved = finalizeRedirectUri(`http://localhost:${port}/api/auth/github/callback`);
  } else if (req && allowed.length > 0) {
    const fromHost = githubCallbackFromRequestHost(req, allowed);
    if (fromHost) resolved = finalizeRedirectUri(fromHost);
  }

  if (resolved === undefined && allowed.length > 0) {
    const base = pickOriginForGithubOAuthCallback(allowed) ?? allowed[0];
    resolved = finalizeRedirectUri(`${base.replace(/\/$/, '')}/api/auth/github/callback`);
  }

  if (resolved === undefined) {
    if (process.env.NODE_ENV === 'development') {
      const port = process.env.API_PORT || '3338';
      resolved = finalizeRedirectUri(`http://localhost:${port}/api/auth/github/callback`);
    } else {
      const pub = readGithubOAuthEnvUrl('GITHUB_OAUTH_PUBLIC_ORIGIN').replace(/\/$/, '');
      if (pub) {
        try {
          const bu = new URL(pub.startsWith('http') ? pub : `https://${pub}`);
          resolved = finalizeRedirectUri(`https://${bu.host}/api/auth/github/callback`);
        } catch {
          resolved = undefined;
        }
      }
      if (resolved === undefined) {
        console.error(
          '[GitHub OAuth] У продакшені не зібрано redirect_uri — задайте FRONTEND_URL, GITHUB_CALLBACK_URL, GITHUB_OAUTH_PUBLIC_ORIGIN або GITHUB_OAUTH_REDIRECT_URI (найкраще повний URL як у GitHub).'
        );
        const port = process.env.API_PORT || '3338';
        resolved = finalizeRedirectUri(`http://localhost:${port}/api/auth/github/callback`);
      }
    }
  }

  return ensureProductionGithubRedirectUsesHttps(resolved);
}

/** Статичний callback (старту, логів) без Host запиту. */
export function resolveGithubCallbackUrl() {
  return resolveGithubCallbackUrlFromRequest(null);
}

/** Лог для продакшен-налагодження: має збігатися з полем Authorization callback URL у OAuth App. */
export function logGithubOAuthRedirectUriHint() {
  if (!process.env.GITHUB_CLIENT_ID?.trim() || !process.env.GITHUB_CLIENT_SECRET?.trim()) return;
  try {
    const uri = resolveGithubCallbackUrl();
    console.log(`[GitHub OAuth] redirect_uri → ${uri}`);
    const origins = parseFrontendOrigins();
    if (origins.length > 1 && !readGithubOAuthEnvUrl('GITHUB_CALLBACK_URL')) {
      console.warn(
        '[GitHub OAuth] Декілька origin у FRONTEND_URL без GITHUB_CALLBACK_URL — для redirect_uri обрано канонічний (пріоритет: https і доменне ім’я). Надійніше задати GITHUB_CALLBACK_URL як у GitHub OAuth App.'
      );
    }
  } catch (e) {
    console.warn('[GitHub OAuth] Callback URL:', e.message);
  }
}

function requireOAuth(req) {
  const id = process.env.GITHUB_CLIENT_ID?.trim();
  const secret = process.env.GITHUB_CLIENT_SECRET?.trim();
  const callback = resolveGithubCallbackUrlFromRequest(req ?? null);
  if (!id || !secret) {
    throw new Error(
      'GitHub OAuth не налаштовано. Задайте GITHUB_CLIENT_ID та GITHUB_CLIENT_SECRET у .env (callback за замовчуванням: див. resolveGithubCallbackUrlFromRequest).'
    );
  }
  return { id, secret, callback };
}

export function isGitHubConfigured() {
  return Boolean(process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim());
}

export function buildAuthorizeUrl({ state, scope, req } = {}) {
  const { id, callback } = requireOAuth(req);
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: callback,
    scope: scope || 'read:user user:email public_repo',
    allow_signup: 'true',
  });
  if (state) params.set('state', state);
  return `${GITHUB_OAUTH}/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code, req) {
  const { id, secret, callback } = requireOAuth(req);
  const res = await fetch(`${GITHUB_OAUTH}/access_token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({
      client_id: id,
      client_secret: secret,
      code,
      redirect_uri: callback,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    const reason = data?.error_description || data?.error || res.statusText;
    throw new Error(`GitHub token exchange failed: ${reason}`);
  }
  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    scope: data.scope,
  };
}

async function githubGet(path, token, query = {}) {
  const url = new URL(path.startsWith('http') ? path : `${GITHUB_API}${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: token ? `Bearer ${token}` : '',
      'User-Agent': USER_AGENT,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (res.status === 401) throw new Error('GitHub token недійсний або відкликаний');
  if (res.status === 403) {
    const rl = res.headers.get('x-ratelimit-remaining');
    if (rl === '0') throw new Error('GitHub API rate limit вичерпано');
  }
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j?.message || msg; } catch { /* ignore */ }
    throw new Error(`GitHub API ${res.status}: ${msg}`);
  }
  return res.json();
}

export function fetchAuthenticatedUser(token) {
  return githubGet('/user', token);
}

export async function fetchUserEmails(token) {
  try {
    return await githubGet('/user/emails', token);
  } catch (e) {
    // Якщо немає scope user:email — повертаємо порожньо
    return [];
  }
}

export async function fetchUserRepos(token, { perPage = 100, maxPages = 3 } = {}) {
  const repos = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await githubGet('/user/repos', token, {
      per_page: perPage,
      page,
      sort: 'updated',
      affiliation: 'owner,collaborator',
      visibility: 'public',
    });
    if (!Array.isArray(batch) || batch.length === 0) break;
    repos.push(...batch);
    if (batch.length < perPage) break;
  }
  return repos;
}

export async function fetchRepoLanguages(token, fullName) {
  try {
    return await githubGet(`/repos/${fullName}/languages`, token);
  } catch {
    return {};
  }
}

/** Зведена статистика стека (мови + топ-теги) по списку repos. */
export function computeStack(repos) {
  const languageTotals = new Map();
  const topicTotals = new Map();
  let totalStars = 0;
  let totalForks = 0;

  for (const r of repos) {
    if (r.fork || r.archived) continue;
    if (r.language) {
      languageTotals.set(r.language, (languageTotals.get(r.language) || 0) + 1);
    }
    if (Array.isArray(r.topics)) {
      for (const t of r.topics) {
        topicTotals.set(t, (topicTotals.get(t) || 0) + 1);
      }
    }
    totalStars += r.stargazers_count || 0;
    totalForks += r.forks_count || 0;
  }

  const sortByCount = (map) =>
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

  return {
    languages: sortByCount(languageTotals).slice(0, 20),
    topics: sortByCount(topicTotals).slice(0, 30),
    totalStars,
    totalForks,
    publicRepoCount: repos.filter((r) => !r.fork && !r.archived).length,
  };
}

/** Витягує public-події останніх 30 днів (proxy для contribution activity). */
export async function fetchPublicEventStats(login) {
  if (!login) return null;
  try {
    const events = await githubGet(`/users/${encodeURIComponent(login)}/events/public`, null, {
      per_page: 100,
    });
    if (!Array.isArray(events)) return null;

    const since = Date.now() - 30 * 24 * 3600 * 1000;
    const recent = events.filter((e) => new Date(e.created_at).getTime() >= since);

    const byType = {};
    let commitCount = 0;
    for (const ev of recent) {
      byType[ev.type] = (byType[ev.type] || 0) + 1;
      if (ev.type === 'PushEvent' && ev.payload?.commits) {
        commitCount += ev.payload.commits.length;
      }
    }

    return {
      windowDays: 30,
      events: recent.length,
      commits: commitCount,
      byType,
    };
  } catch {
    return null;
  }
}

/**
 * GraphQL contribution calendar — справжня contribution-сітка (53 тижні × 7 днів).
 * Потребує scope read:user (уже у нашому OAuth scope).
 */
export async function fetchContributionCalendar(token) {
  if (!token) return null;
  const query = `
    query {
      viewer {
        login
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                color
                weekday
              }
            }
          }
          totalCommitContributions
          totalIssueContributions
          totalPullRequestContributions
          totalPullRequestReviewContributions
          totalRepositoryContributions
        }
      }
    }
  `;

  const res = await fetch(`${GITHUB_API}/graphql`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j?.message || msg; } catch { /* ignore */ }
    throw new Error(`GitHub GraphQL ${res.status}: ${msg}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL: ${json.errors.map((e) => e.message).join('; ')}`);
  }

  const cc = json?.data?.viewer?.contributionsCollection;
  if (!cc?.contributionCalendar) return null;

  const calendar = cc.contributionCalendar;
  const weeks = (calendar.weeks || []).map((w) => ({
    days: (w.contributionDays || []).map((d) => ({
      date: d.date,
      count: d.contributionCount,
      color: d.color,
      weekday: d.weekday,
    })),
  }));

  return {
    totalContributions: calendar.totalContributions,
    weeks,
    breakdown: {
      commits: cc.totalCommitContributions,
      issues: cc.totalIssueContributions,
      pullRequests: cc.totalPullRequestContributions,
      reviews: cc.totalPullRequestReviewContributions,
      repositories: cc.totalRepositoryContributions,
    },
  };
}

/**
 * Підтягнути публічні метадані репозиторію без авторизованого токена
 * (для лінкування repos до контенту).
 * Лімит unauthenticated: 60 запитів/година з одного IP.
 */
export async function fetchPublicRepoMetadata(fullName, token) {
  if (!fullName || !fullName.includes('/')) {
    throw new Error('Очікується формат власник/назва');
  }
  const [owner, repo] = fullName.split('/').slice(0, 2);
  return githubGet(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token);
}

/**
 * Обчислення бейджів на основі stack/activity/contributions.
 */
export function computeBadges({ stack, activity, contributions }) {
  const badges = [];

  if (stack?.publicRepoCount >= 10) {
    badges.push({ id: 'oss-builder', label: 'Будівник OSS', description: '10+ публічних репозиторіїв' });
  } else if (stack?.publicRepoCount >= 3) {
    badges.push({ id: 'open-source', label: 'Відкритий код', description: '3+ публічних репозиторіїв' });
  }

  if ((stack?.languages?.length || 0) >= 5) {
    badges.push({ id: 'polyglot', label: 'Поліглот', description: `${stack.languages.length} різних мов у коді` });
  }

  if (stack?.totalStars >= 1000) {
    badges.push({ id: 'star-collector', label: 'Збирач зірок', description: '1k+ зірок' });
  } else if (stack?.totalStars >= 100) {
    badges.push({ id: 'starred', label: 'У полі зору', description: '100+ зірок' });
  } else if (stack?.totalStars >= 25) {
    badges.push({ id: 'noticed', label: 'Помічений', description: '25+ зірок' });
  }

  if (activity?.commits >= 100) {
    badges.push({ id: 'prolific-committer', label: 'Плідний комітер', description: '100+ комітів за 30 днів' });
  } else if (activity?.commits >= 30) {
    badges.push({ id: 'active', label: 'Активний', description: '30+ комітів за 30 днів' });
  }

  if (contributions?.totalContributions >= 1000) {
    badges.push({ id: 'year-grinder', label: 'Тисячник року', description: '1000+ контрибуцій за рік' });
  } else if (contributions?.totalContributions >= 365) {
    badges.push({ id: 'daily-coder', label: 'Щоденний кодер', description: '365+ контрибуцій за рік' });
  }

  if (contributions?.breakdown?.pullRequests >= 50) {
    badges.push({ id: 'pr-machine', label: 'Майстер pull request-ів', description: '50+ PR за рік' });
  }
  if (contributions?.breakdown?.reviews >= 50) {
    badges.push({ id: 'reviewer', label: 'Рев’юер', description: '50+ переглядів коду' });
  }

  return badges;
}

export function pickPublicProfile(ghUser) {
  if (!ghUser) return null;
  return {
    id: ghUser.id,
    login: ghUser.login,
    name: ghUser.name,
    bio: ghUser.bio,
    company: ghUser.company,
    location: ghUser.location,
    blog: ghUser.blog,
    avatar_url: ghUser.avatar_url,
    html_url: ghUser.html_url,
    twitter_username: ghUser.twitter_username,
    public_repos: ghUser.public_repos,
    public_gists: ghUser.public_gists,
    followers: ghUser.followers,
    following: ghUser.following,
    created_at: ghUser.created_at,
    updated_at: ghUser.updated_at,
  };
}
