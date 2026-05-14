/**
 * Нормалізація тегів для перетину між постами спільноти (stack) і Q&A (теги).
 */

export const TAG_SYNONYMS = {
  js: 'javascript',
  ts: 'typescript',
  jsx: 'react',
  tsx: 'react',
  py: 'python',
  rb: 'ruby',
  golang: 'go',
  k8s: 'kubernetes',
  pg: 'postgresql',
  postgres: 'postgresql',
};

export function normalizeTag(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  return TAG_SYNONYMS[s] || s;
}

export function normalizeTagList(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const t = normalizeTag(x);
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}
