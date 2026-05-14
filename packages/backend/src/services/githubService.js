/**
 * GitHub API клієнт.
 *
 * Реалізація на вбудованому fetch (Node 18+). Без сторонніх залежностей.
 * Документація: https://docs.github.com/en/rest
 *
 * Очікувані env:
 *   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL
 */

const GITHUB_API = 'https://api.github.com';
const GITHUB_OAUTH = 'https://github.com/login/oauth';
const USER_AGENT = 'UkrOverflow-Knowledge-Hub';

function requireEnv() {
  const id = process.env.GITHUB_CLIENT_ID;
  const secret = process.env.GITHUB_CLIENT_SECRET;
  const callback = process.env.GITHUB_CALLBACK_URL;
  if (!id || !secret || !callback) {
    throw new Error(
      'GitHub OAuth не налаштовано. Задайте GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL у .env'
    );
  }
  return { id, secret, callback };
}

export function isGitHubConfigured() {
  return Boolean(
    process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      process.env.GITHUB_CALLBACK_URL
  );
}

export function buildAuthorizeUrl({ state, scope } = {}) {
  const { id, callback } = requireEnv();
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: callback,
    scope: scope || 'read:user user:email public_repo',
    allow_signup: 'true',
  });
  if (state) params.set('state', state);
  return `${GITHUB_OAUTH}/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code) {
  const { id, secret, callback } = requireEnv();
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
    throw new Error('Очікую формат owner/name');
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
    badges.push({ id: 'oss-builder', label: 'OSS Builder', description: '10+ публічних репозиторіїв' });
  } else if (stack?.publicRepoCount >= 3) {
    badges.push({ id: 'open-source', label: 'Open Source', description: '3+ публічних репозиторіїв' });
  }

  if ((stack?.languages?.length || 0) >= 5) {
    badges.push({ id: 'polyglot', label: 'Polyglot', description: `${stack.languages.length} різних мов у коді` });
  }

  if (stack?.totalStars >= 1000) {
    badges.push({ id: 'star-collector', label: 'Star Collector', description: '1k+ зірок' });
  } else if (stack?.totalStars >= 100) {
    badges.push({ id: 'starred', label: 'Starred', description: '100+ зірок' });
  } else if (stack?.totalStars >= 25) {
    badges.push({ id: 'noticed', label: 'Noticed', description: '25+ зірок' });
  }

  if (activity?.commits >= 100) {
    badges.push({ id: 'prolific-committer', label: 'Prolific Committer', description: '100+ commits за 30 днів' });
  } else if (activity?.commits >= 30) {
    badges.push({ id: 'active', label: 'Active', description: '30+ commits за 30 днів' });
  }

  if (contributions?.totalContributions >= 1000) {
    badges.push({ id: 'year-grinder', label: 'Year Grinder', description: '1000+ контрибуцій за рік' });
  } else if (contributions?.totalContributions >= 365) {
    badges.push({ id: 'daily-coder', label: 'Daily Coder', description: '365+ контрибуцій за рік' });
  }

  if (contributions?.breakdown?.pullRequests >= 50) {
    badges.push({ id: 'pr-machine', label: 'PR Machine', description: '50+ PR за рік' });
  }
  if (contributions?.breakdown?.reviews >= 50) {
    badges.push({ id: 'reviewer', label: 'Reviewer', description: '50+ code reviews' });
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
