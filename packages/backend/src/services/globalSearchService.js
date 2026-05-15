/**
 * Глобальний пошук по матеріалах хабу (+ пости спільноти).
 * Повертає уніфіковані записи { type, id, title, excerpt, created_at, ... }.
 */

import pool from '../config/database.js';
import { CONTENT_TYPES } from '../constants/contentTypes.js';

function clip(s, max = 220) {
  if (!s || typeof s !== 'string') return '';
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function rowToHit(type, id, title, excerptSource, extra = {}) {
  return {
    type,
    id,
    title: title || '',
    excerpt: clip(excerptSource),
    ...extra,
  };
}

const HUB_TYPES = [
  CONTENT_TYPES.QUESTION,
  CONTENT_TYPES.ARTICLE,
  CONTENT_TYPES.GUIDE,
  CONTENT_TYPES.SNIPPET,
  CONTENT_TYPES.ROADMAP,
  CONTENT_TYPES.BEST_PRACTICE,
  CONTENT_TYPES.FAQ,
];

/**
 * @param {string} q
 * @param {{ types?: string[], limitPerType?: number }} opts
 */
export async function globalSearch(q, opts = {}) {
  const needle = String(q || '').trim();
  if (needle.length < 2) {
    return { hits: [], query: needle };
  }

  const allow = opts.types?.length ? new Set(opts.types) : null;
  const want = (t) => !allow || allow.has(t);
  const cap = Math.min(Math.max(parseInt(opts.limitPerType, 10) || 12, 4), 40);

  const tasks = [];

  if (want(CONTENT_TYPES.QUESTION)) {
    tasks.push(
      pool
        .execute(
          `SELECT q.id, q.title, q.body, q.created_at, q.views, u.username AS author_name,
                  MATCH(q.title, q.body) AGAINST (? IN NATURAL LANGUAGE MODE) AS rel
           FROM questions q
           JOIN users u ON q.author_id = u.id
           WHERE MATCH(q.title, q.body) AGAINST (? IN NATURAL LANGUAGE MODE)
           ORDER BY rel DESC, q.created_at DESC
           LIMIT ${cap}`,
          [needle, needle]
        )
        .then(([rows]) =>
          rows.map((r) =>
            rowToHit(CONTENT_TYPES.QUESTION, r.id, r.title, r.body, {
              created_at: r.created_at,
              views: r.views,
              author_name: r.author_name,
            })
          )
        )
    );
  } else {
    tasks.push(Promise.resolve([]));
  }

  if (want(CONTENT_TYPES.ARTICLE)) {
    tasks.push(
      pool
        .execute(
          `SELECT a.id, a.title, a.excerpt, a.body, a.created_at, a.views, u.username AS author_name,
                  MATCH(a.title, a.body, a.excerpt) AGAINST (? IN NATURAL LANGUAGE MODE) AS rel
           FROM articles a
           JOIN users u ON a.author_id = u.id
           WHERE MATCH(a.title, a.body, a.excerpt) AGAINST (? IN NATURAL LANGUAGE MODE)
           ORDER BY rel DESC, a.created_at DESC
           LIMIT ${cap}`,
          [needle, needle]
        )
        .then(([rows]) =>
          rows.map((r) =>
            rowToHit(CONTENT_TYPES.ARTICLE, r.id, r.title, r.excerpt || r.body, {
              created_at: r.created_at,
              views: r.views,
              author_name: r.author_name,
            })
          )
        )
    );
  } else {
    tasks.push(Promise.resolve([]));
  }

  if (want(CONTENT_TYPES.GUIDE)) {
    tasks.push(
      pool
        .execute(
          `SELECT g.id, g.title, g.summary, g.body, g.created_at, g.views, u.username AS author_name,
                  MATCH(g.title, g.summary, g.body, g.excerpt) AGAINST (? IN NATURAL LANGUAGE MODE) AS rel
           FROM guides g
           JOIN users u ON g.author_id = u.id
           WHERE MATCH(g.title, g.summary, g.body, g.excerpt) AGAINST (? IN NATURAL LANGUAGE MODE)
           ORDER BY rel DESC, g.created_at DESC
           LIMIT ${cap}`,
          [needle, needle]
        )
        .then(([rows]) =>
          rows.map((r) =>
            rowToHit(CONTENT_TYPES.GUIDE, r.id, r.title, r.summary || r.body, {
              created_at: r.created_at,
              views: r.views,
              author_name: r.author_name,
            })
          )
        )
    );
  } else {
    tasks.push(Promise.resolve([]));
  }

  if (want(CONTENT_TYPES.SNIPPET)) {
    tasks.push(
      pool
        .execute(
          `SELECT s.id, s.title, s.description, s.created_at, s.views, u.username AS author_name,
                  MATCH(s.title, s.description, s.excerpt) AGAINST (? IN NATURAL LANGUAGE MODE) AS rel
           FROM snippets s
           JOIN users u ON s.author_id = u.id
           WHERE MATCH(s.title, s.description, s.excerpt) AGAINST (? IN NATURAL LANGUAGE MODE)
           ORDER BY rel DESC, s.created_at DESC
           LIMIT ${cap}`,
          [needle, needle]
        )
        .then(([rows]) =>
          rows.map((r) =>
            rowToHit(CONTENT_TYPES.SNIPPET, r.id, r.title, r.description, {
              created_at: r.created_at,
              views: r.views,
              author_name: r.author_name,
            })
          )
        )
    );
  } else {
    tasks.push(Promise.resolve([]));
  }

  if (want(CONTENT_TYPES.ROADMAP)) {
    tasks.push(
      pool
        .execute(
          `SELECT r.id, r.title, r.summary, r.body, r.created_at, r.views, u.username AS author_name,
                  MATCH(r.title, r.summary, r.body, r.excerpt) AGAINST (? IN NATURAL LANGUAGE MODE) AS rel
           FROM roadmaps r
           JOIN users u ON r.author_id = u.id
           WHERE MATCH(r.title, r.summary, r.body, r.excerpt) AGAINST (? IN NATURAL LANGUAGE MODE)
           ORDER BY rel DESC, r.created_at DESC
           LIMIT ${cap}`,
          [needle, needle]
        )
        .then(([rows]) =>
          rows.map((r) =>
            rowToHit(CONTENT_TYPES.ROADMAP, r.id, r.title, r.summary || r.body, {
              created_at: r.created_at,
              views: r.views,
              author_name: r.author_name,
            })
          )
        )
    );
  } else {
    tasks.push(Promise.resolve([]));
  }

  if (want(CONTENT_TYPES.BEST_PRACTICE)) {
    tasks.push(
      pool
        .execute(
          `SELECT b.id, b.title, b.rule, b.body, b.created_at, b.views, u.username AS author_name,
                  MATCH(b.title, b.rule, b.body, b.excerpt) AGAINST (? IN NATURAL LANGUAGE MODE) AS rel
           FROM best_practices b
           JOIN users u ON b.author_id = u.id
           WHERE MATCH(b.title, b.rule, b.body, b.excerpt) AGAINST (? IN NATURAL LANGUAGE MODE)
           ORDER BY rel DESC, b.created_at DESC
           LIMIT ${cap}`,
          [needle, needle]
        )
        .then(([rows]) =>
          rows.map((r) =>
            rowToHit(CONTENT_TYPES.BEST_PRACTICE, r.id, r.title, r.rule || r.body, {
              created_at: r.created_at,
              views: r.views,
              author_name: r.author_name,
            })
          )
        )
    );
  } else {
    tasks.push(Promise.resolve([]));
  }

  if (want(CONTENT_TYPES.FAQ)) {
    tasks.push(
      pool
        .execute(
          `SELECT f.id, f.title, f.topic, f.body, f.created_at, f.views, u.username AS author_name,
                  MATCH(f.title, f.topic, f.body, f.excerpt) AGAINST (? IN NATURAL LANGUAGE MODE) AS rel
           FROM faqs f
           JOIN users u ON f.author_id = u.id
           WHERE MATCH(f.title, f.topic, f.body, f.excerpt) AGAINST (? IN NATURAL LANGUAGE MODE)
           ORDER BY rel DESC, f.created_at DESC
           LIMIT ${cap}`,
          [needle, needle]
        )
        .then(([rows]) =>
          rows.map((r) =>
            rowToHit(CONTENT_TYPES.FAQ, r.id, r.title, r.topic ? `${r.topic} — ${r.body}` : r.body, {
              created_at: r.created_at,
              views: r.views,
              author_name: r.author_name,
            })
          )
        )
    );
  } else {
    tasks.push(Promise.resolve([]));
  }

  // Пости спільноти: FULLTEXT якщо є індекс, інакше LIKE
  let communityHits = [];
  if (want('community_post')) {
    try {
      const [rows] = await pool.execute(
        `SELECT p.id, p.title, p.body, p.created_at, p.views, p.community_id,
                c.slug AS community_slug, c.name AS community_name, u.username AS author_name,
                MATCH(p.title, p.body) AGAINST (? IN NATURAL LANGUAGE MODE) AS rel
         FROM community_posts p
         JOIN communities c ON p.community_id = c.id
         JOIN users u ON p.author_id = u.id
         WHERE MATCH(p.title, p.body) AGAINST (? IN NATURAL LANGUAGE MODE)
         ORDER BY rel DESC, p.created_at DESC
         LIMIT ${cap}`,
        [needle, needle]
      );
      communityHits = rows.map((r) =>
        rowToHit('community_post', r.id, r.title, r.body, {
          created_at: r.created_at,
          views: r.views,
          author_name: r.author_name,
          community_slug: r.community_slug,
          community_name: r.community_name,
          community_id: r.community_id,
        })
      );
    } catch {
      const like = `%${needle}%`;
      const [rows] = await pool.execute(
        `SELECT p.id, p.title, p.body, p.created_at, p.views, p.community_id,
                c.slug AS community_slug, c.name AS community_name, u.username AS author_name
         FROM community_posts p
         JOIN communities c ON p.community_id = c.id
         JOIN users u ON p.author_id = u.id
         WHERE p.title LIKE ? OR p.body LIKE ?
         ORDER BY p.created_at DESC
         LIMIT ${cap}`,
        [like, like]
      );
      communityHits = rows.map((r) =>
        rowToHit('community_post', r.id, r.title, r.body, {
          created_at: r.created_at,
          views: r.views,
          author_name: r.author_name,
          community_slug: r.community_slug,
          community_name: r.community_name,
          community_id: r.community_id,
        })
      );
    }
  }

  const parts = await Promise.all(tasks);
  const merged = [...parts.flat(), ...communityHits];

  merged.sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return tb - ta;
  });

  return {
    hits: merged,
    query: needle,
    typesSearched: allow ? [...allow] : [...HUB_TYPES, 'community_post'],
  };
}

async function searchNews(needle, limit = 4) {
  const like = `%${needle}%`;
  try {
    const [rows] = await pool.execute(
      `SELECT id, title, slug, summary
       FROM news_posts
       WHERE title LIKE ? OR summary LIKE ?
       ORDER BY views DESC, published_at DESC
       LIMIT ${Math.min(limit, 8)}`,
      [like, like],
    );
    return rows.map((r) =>
      rowToHit('news', r.id, r.title, r.summary, {
        slug: r.slug,
      }),
    );
  } catch {
    return [];
  }
}

let tagSuggestCache = { at: 0, list: [] };

async function findTagSuggestions(needle, limit = 6) {
  const q = needle.toLowerCase();
  if (Date.now() - tagSuggestCache.at > 120_000 || !tagSuggestCache.list.length) {
    const { aggregateAllTags } = await import('./tagsAggregateService.js');
    tagSuggestCache.list = await aggregateAllTags();
    tagSuggestCache.at = Date.now();
  }
  return tagSuggestCache.list
    .filter((t) => t.name.includes(q))
    .slice(0, limit)
    .map((t) => ({ name: t.name, count: t.count }));
}

async function searchCommunities(needle, limit = 6) {
  const like = `%${needle}%`;
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, slug, description, type, member_count
       FROM communities
       WHERE is_public = 1
         AND (name LIKE ? OR description LIKE ? OR location LIKE ? OR slug LIKE ?)
       ORDER BY member_count DESC, post_count DESC
       LIMIT ${Math.min(limit, 12)}`,
      [like, like, like, like],
    );
    return rows.map((r) =>
      rowToHit('community', r.id, r.name, r.description, {
        slug: r.slug,
        community_type: r.type,
        member_count: r.member_count,
      }),
    );
  } catch {
    return [];
  }
}

async function searchUsers(needle, limit = 6, { mentorsOnly = false } = {}) {
  const like = `%${needle}%`;
  try {
    const join = mentorsOnly
      ? ' INNER JOIN mentor_profiles mp ON mp.user_id = u.id AND mp.is_active = 1 '
      : '';
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.avatar_url, u.location, u.reputation, u.bio
       FROM users u
       ${join}
       WHERE (u.username LIKE ? OR u.bio LIKE ? OR u.github_login LIKE ? OR u.location LIKE ?)
       ORDER BY u.reputation DESC
       LIMIT ${Math.min(limit, 12)}`,
      [like, like, like, like],
    );
    return rows.map((r) =>
      rowToHit(mentorsOnly ? 'mentor' : 'user', r.id, r.username, r.bio || r.location, {
        location: r.location,
        reputation: r.reputation,
      }),
    );
  } catch {
    return [];
  }
}

function emptyLivePayload(needle) {
  return {
    query: needle,
    hits: [],
    tags: [],
    news: [],
    communities: [],
    mentors: [],
    users: [],
    total: 0,
  };
}

/**
 * Швидкий пошук для автодоповнення (хедер, сторінки, фільтри).
 * @param {string} q
 * @param {{ scope?: 'all'|'hub'|'news'|'communities'|'tags'|'mentors'|'users' }} opts
 */
export async function liveSearch(q, opts = {}) {
  const needle = String(q || '').trim();
  const scope = opts.scope || 'all';

  if (needle.length < 2) {
    return emptyLivePayload(needle);
  }

  switch (scope) {
    case 'news': {
      const news = await searchNews(needle, 10);
      const tags = await findTagSuggestions(needle, 4);
      return { ...emptyLivePayload(needle), news, tags, total: news.length + tags.length };
    }
    case 'communities': {
      const communities = await searchCommunities(needle, 10);
      return { ...emptyLivePayload(needle), communities, total: communities.length };
    }
    case 'tags': {
      const tags = await findTagSuggestions(needle, 14);
      return { ...emptyLivePayload(needle), tags, total: tags.length };
    }
    case 'mentors': {
      const mentors = await searchUsers(needle, 10, { mentorsOnly: true });
      return { ...emptyLivePayload(needle), mentors, total: mentors.length };
    }
    case 'users': {
      const users = await searchUsers(needle, 10, { mentorsOnly: false });
      return { ...emptyLivePayload(needle), users, total: users.length };
    }
    case 'hub': {
      const [{ hits }, tags] = await Promise.all([
        globalSearch(needle, { limitPerType: 3 }),
        findTagSuggestions(needle, 6),
      ]);
      const sliced = hits.slice(0, 12);
      return {
        query: needle,
        hits: sliced,
        tags,
        news: [],
        communities: [],
        mentors: [],
        users: [],
        total: sliced.length + tags.length,
      };
    }
    default: {
      const [{ hits }, tags, news, communities, mentors, users] = await Promise.all([
        globalSearch(needle, { limitPerType: 2 }),
        findTagSuggestions(needle, 6),
        searchNews(needle, 4),
        searchCommunities(needle, 3),
        searchUsers(needle, 2, { mentorsOnly: true }),
        searchUsers(needle, 2, { mentorsOnly: false }),
      ]);
      const slicedHits = hits.slice(0, 10);
      const total =
        slicedHits.length +
        tags.length +
        news.length +
        communities.length +
        mentors.length +
        users.length;
      return {
        query: needle,
        hits: slicedHits,
        tags,
        news,
        communities,
        mentors,
        users,
        total,
      };
    }
  }
}
