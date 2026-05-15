/**
 * Типи сутностей для таблиці votes (POST /api/votes).
 */

import { HUB_TYPE_TABLE } from '../utils/hubTables.js';

export const VOTE_ENTITY_TYPES = [
  'question',
  'answer',
  'content',
  'content_answer',
  'article',
  'guide',
  'snippet',
  'roadmap',
  'best_practice',
  'faq',
  'community_post',
  'community_post_comment',
  'news_post',
  'news_comment',
];

/** Таблиця з author_id для репутації та сповіщень */
export const VOTE_AUTHOR_TABLE = {
  question: 'questions',
  answer: 'answers',
  content: 'content_items',
  content_answer: 'content_answers',
  community_post: 'community_posts',
  community_post_comment: 'community_post_comments',
  news_post: 'news_posts',
  news_comment: 'news_comments',
  ...HUB_TYPE_TABLE,
};

export function isVoteEntityType(type) {
  return VOTE_ENTITY_TYPES.includes(type);
}
