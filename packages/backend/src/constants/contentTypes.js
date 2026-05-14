export const CONTENT_TYPES = {
  QUESTION: 'question',
  ARTICLE: 'article',
  GUIDE: 'guide',
  SNIPPET: 'snippet',
  ROADMAP: 'roadmap',
  BEST_PRACTICE: 'best_practice',
  FAQ: 'faq',
};

export const AVAILABLE_CONTENT_TYPES = [CONTENT_TYPES.QUESTION];

export function isSupportedContentType(type) {
  return AVAILABLE_CONTENT_TYPES.includes(type);
}
