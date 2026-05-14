/**
 * Єдине джерело типів контенту для API та фронтенду.
 */

export const CONTENT_TYPES = {
  QUESTION: 'question',
  ARTICLE: 'article',
  GUIDE: 'guide',
  SNIPPET: 'snippet',
  ROADMAP: 'roadmap',
  BEST_PRACTICE: 'best_practice',
  FAQ: 'faq',
  /** Пости в таблиці community_posts (не content_items) */
  COMMUNITY_POST: 'community_post',
};

/** Матеріали хабу, на які можна посилатися з поста спільноти */
export const LINKABLE_HUB_TYPES = [
  CONTENT_TYPES.QUESTION,
  CONTENT_TYPES.ARTICLE,
  CONTENT_TYPES.GUIDE,
  CONTENT_TYPES.SNIPPET,
  CONTENT_TYPES.ROADMAP,
  CONTENT_TYPES.BEST_PRACTICE,
  CONTENT_TYPES.FAQ,
];
