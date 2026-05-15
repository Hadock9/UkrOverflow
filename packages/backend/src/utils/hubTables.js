/** Мапінг типу hub-контенту на таблицю MySQL (author_id). */
export const HUB_TYPE_TABLE = {
  question: 'questions',
  article: 'articles',
  guide: 'guides',
  snippet: 'snippets',
  roadmap: 'roadmaps',
  best_practice: 'best_practices',
  faq: 'faqs',
};

export function hubTableForType(type) {
  return HUB_TYPE_TABLE[type] || null;
}
