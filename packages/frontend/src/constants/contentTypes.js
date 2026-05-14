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
    available: true,
  },
  {
    id: CONTENT_TYPES.GUIDE,
    label: 'МІНІ-ГАЙДИ',
    shortLabel: 'Міні-гайди',
    description: 'Короткі покрокові інструкції.',
    available: true,
  },
  {
    id: CONTENT_TYPES.SNIPPET,
    label: 'СНІПЕТИ',
    shortLabel: 'Сніпети',
    description: 'Готові фрагменти коду з поясненням.',
    available: true,
  },
  {
    id: CONTENT_TYPES.ROADMAP,
    label: 'МАРШРУТИ',
    shortLabel: 'Маршрути',
    description: 'Навчальні маршрути й етапи розвитку.',
    available: true,
  },
  {
    id: CONTENT_TYPES.BEST_PRACTICE,
    label: 'НАЙКРАЩІ ПРАКТИКИ',
    shortLabel: 'Практики',
    description: 'Перевірені підходи, правила й антипатерни.',
    available: true,
  },
  {
    id: CONTENT_TYPES.FAQ,
    label: 'ЧАСТІ ЗАПИТАННЯ',
    shortLabel: 'ЧаП',
    description: 'Часті запитання про технології.',
    available: true,
  },
];

export const AVAILABLE_CONTENT_TYPES = CONTENT_TYPE_DEFINITIONS.filter((item) => item.available).map((item) => item.id);

export function getContentTypeMeta(type) {
  return CONTENT_TYPE_DEFINITIONS.find((item) => item.id === type) || CONTENT_TYPE_DEFINITIONS[1];
}
