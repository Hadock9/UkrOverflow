export const CONTENT_TYPES = {
  ALL: 'all',
  QUESTION: 'question',
  ARTICLE: 'article',
  GUIDE: 'guide',
  SNIPPET: 'snippet',
  ROADMAP: 'roadmap',
  BEST_PRACTICE: 'best_practice',
  FAQ: 'faq',
};

export const CONTENT_TYPE_DEFINITIONS = [
  {
    id: CONTENT_TYPES.ALL,
    label: 'УСЕ',
    shortLabel: 'Усе',
    description: 'Уся база знань в одному потоці.',
    available: true,
  },
  {
    id: CONTENT_TYPES.QUESTION,
    label: 'ПИТАННЯ',
    shortLabel: 'Питання',
    description: 'Проблеми, обговорення і відповіді від спільноти.',
    available: true,
  },
  {
    id: CONTENT_TYPES.ARTICLE,
    label: 'СТАТТІ',
    shortLabel: 'Статті',
    description: 'Довгі матеріали й розбори тем.',
    available: false,
  },
  {
    id: CONTENT_TYPES.GUIDE,
    label: 'МІНІ-ГАЙДИ',
    shortLabel: 'Міні-гайди',
    description: 'Короткі покрокові інструкції.',
    available: false,
  },
  {
    id: CONTENT_TYPES.SNIPPET,
    label: 'SNIPPETS',
    shortLabel: 'Snippets',
    description: 'Готові фрагменти коду з поясненням.',
    available: false,
  },
  {
    id: CONTENT_TYPES.ROADMAP,
    label: 'ROADMAP-И',
    shortLabel: 'Roadmap-и',
    description: 'Навчальні маршрути й етапи розвитку.',
    available: false,
  },
  {
    id: CONTENT_TYPES.BEST_PRACTICE,
    label: 'BEST PRACTICES',
    shortLabel: 'Best practices',
    description: 'Перевірені підходи, правила і антипатерни.',
    available: false,
  },
  {
    id: CONTENT_TYPES.FAQ,
    label: 'FAQ',
    shortLabel: 'FAQ',
    description: 'Часті питання по технологіях.',
    available: false,
  },
];

export const AVAILABLE_CONTENT_TYPES = CONTENT_TYPE_DEFINITIONS.filter((item) => item.available).map((item) => item.id);

export function getContentTypeMeta(type) {
  return CONTENT_TYPE_DEFINITIONS.find((item) => item.id === type) || CONTENT_TYPE_DEFINITIONS[1];
}
