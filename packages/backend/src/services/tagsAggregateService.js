/**
 * Агрегація тегів з усіх розділів платформи (hub, новини, спільноти).
 */

import pool from '../config/database.js';

const SOURCE_LABELS = {
  question: 'Питання',
  article: 'Статті',
  guide: 'Гайди',
  snippet: 'Сніпети',
  roadmap: 'Маршрути',
  best_practice: 'Практики',
  faq: 'ЧаП',
  news: 'Новини',
  community: "Спільноти",
};

function parseTagsField(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return [];
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
      }
    } catch {
      /* comma-separated */
    }
    return t.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

function bump(map, tagName, source) {
  const key = tagName.toLowerCase();
  if (!key || key.length > 40) return;
  if (!map.has(key)) {
    map.set(key, { name: key, count: 0, bySource: {} });
  }
  const row = map.get(key);
  row.count += 1;
  row.bySource[source] = (row.bySource[source] || 0) + 1;
}

async function collectFromTable(map, table, column, source) {
  try {
    const [rows] = await pool.execute(`SELECT ${column} AS tags FROM ${table}`);
    for (const row of rows) {
      parseTagsField(row.tags).forEach((t) => bump(map, t, source));
    }
  } catch (err) {
    if (err?.code !== 'ER_NO_SUCH_TABLE' && err?.errno !== 1146) {
      console.warn(`[tags] skip ${table}:`, err.message);
    }
  }
}

export async function aggregateAllTags() {
  const map = new Map();

  await collectFromTable(map, 'questions', 'tags', 'question');
  await collectFromTable(map, 'articles', 'tags', 'article');
  await collectFromTable(map, 'guides', 'tags', 'guide');
  await collectFromTable(map, 'snippets', 'tags', 'snippet');
  await collectFromTable(map, 'roadmaps', 'tags', 'roadmap');
  await collectFromTable(map, 'best_practices', 'tags', 'best_practice');
  await collectFromTable(map, 'faqs', 'tags', 'faq');
  await collectFromTable(map, 'news_posts', 'tags', 'news');
  await collectFromTable(map, 'communities', 'tags', 'community');

  return Array.from(map.values()).map((t) => ({
    ...t,
    hubCount:
      (t.bySource.question || 0)
      + (t.bySource.article || 0)
      + (t.bySource.guide || 0)
      + (t.bySource.snippet || 0)
      + (t.bySource.roadmap || 0)
      + (t.bySource.best_practice || 0)
      + (t.bySource.faq || 0),
  }));
}

export function filterAndSortTags(tags, { search, source, sortBy = 'count' }) {
  let list = [...tags];

  if (search) {
    const q = search.toLowerCase();
    list = list.filter((t) => t.name.includes(q));
  }

  if (source && source !== 'all') {
    list = list.filter((t) => (t.bySource[source] || 0) > 0);
  }

  if (sortBy === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  } else {
    list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'uk'));
  }

  return list;
}

export { SOURCE_LABELS };
