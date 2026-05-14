import { CONTENT_TYPES } from './contentTypes.js';

/**
 * Шлях до сторінки перегляду сутності в SPA (без префікса /api).
 */
export function getContentDetailPath(type, id) {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return '/';
  switch (type) {
    case CONTENT_TYPES.ARTICLE:
      return `/articles/${n}`;
    case CONTENT_TYPES.GUIDE:
      return `/guides/${n}`;
    case CONTENT_TYPES.SNIPPET:
      return `/snippets/${n}`;
    case CONTENT_TYPES.ROADMAP:
      return `/roadmaps/${n}`;
    case CONTENT_TYPES.BEST_PRACTICE:
      return `/best-practices/${n}`;
    case CONTENT_TYPES.FAQ:
      return `/faqs/${n}`;
    case CONTENT_TYPES.COMMUNITY_POST:
      return `/community-posts/${n}`;
    case CONTENT_TYPES.QUESTION:
    default:
      return `/questions/${n}`;
  }
}
