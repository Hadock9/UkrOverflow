/**
 * Тексти та посилання для сповіщень (синхронно з backend Notification).
 */

import { CONTENT_TYPES, getContentDetailPath } from '@ukroverflow/shared';

export const NOTIFICATIONS_UPDATED_EVENT = 'devflow:notifications-updated';

export function notifyNotificationsUpdated() {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT));
}

const HUB_ENTITY_TYPES = new Set([
  CONTENT_TYPES.ARTICLE,
  CONTENT_TYPES.GUIDE,
  CONTENT_TYPES.SNIPPET,
  CONTENT_TYPES.ROADMAP,
  CONTENT_TYPES.BEST_PRACTICE,
  CONTENT_TYPES.FAQ,
]);

const HUB_VOTE_LABEL = {
  [CONTENT_TYPES.ARTICLE]: 'статтю',
  [CONTENT_TYPES.GUIDE]: 'гайд',
  [CONTENT_TYPES.SNIPPET]: 'сніпет',
  [CONTENT_TYPES.ROADMAP]: 'маршрут',
  [CONTENT_TYPES.BEST_PRACTICE]: 'найкращу практику',
  [CONTENT_TYPES.FAQ]: 'ЧаП',
};

export function parseNotificationData(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** MySQL BOOLEAN / TINYINT може прийти як 0, 1, true, false, '0', '1'. */
export function isNotificationUnread(n) {
  if (!n) return false;
  const v = n.is_read;
  if (v === true || v === 1 || v === '1') return false;
  if (v === false || v === 0 || v === '0' || v == null) return true;
  return !v;
}

export function notificationContextTitle(n) {
  const d = parseNotificationData(n.data);
  const raw =
    n.context_title ||
    n.question_title ||
    d.title ||
    d.postTitle ||
    (n.type === 'community_join' || n.type === 'community_welcome' ? d.communityName : null);
  if (!raw || typeof raw !== 'string') return '';
  const t = raw.trim();
  return t ? `«${t}»` : '';
}

function hubDetailPath(entityType, entityId, data = {}) {
  const type = data.hubType || data.contentType || entityType;
  if (type && entityId && (HUB_ENTITY_TYPES.has(type) || type === CONTENT_TYPES.QUESTION)) {
    return getContentDetailPath(type, entityId);
  }
  return null;
}

export function notificationLink(n) {
  const d = parseNotificationData(n.data);

  switch (n.type) {
    case 'community_join':
    case 'community_welcome':
      return d.slug ? `/communities/${d.slug}` : '/communities';
    case 'community_new_post':
    case 'community_post_comment':
    case 'community_post_reply':
    case 'community_thread_activity':
    case 'community_post_status':
    case 'hub_linked_in_post':
      return `/community-posts/${n.entity_id}`;
    case 'news_post_comment':
    case 'news_comment_reply':
    case 'news_thread_activity':
    case 'news_published':
      return d.slug ? `/news/${d.slug}` : `/news/${n.entity_id}`;
    case 'answer_accepted':
      return d.questionId ? `/questions/${d.questionId}` : '/hub';
    case 'question_answer':
    case 'question_bookmark':
    case 'question_activity':
      if (n.entity_type === 'question') return `/questions/${n.entity_id}`;
      return '/hub';
    case 'vote': {
      if (n.entity_type === 'question') return `/questions/${n.entity_id}`;
      if (n.entity_type === 'answer' && d.questionId) return `/questions/${d.questionId}`;
      if (n.entity_type === 'content' && d.contentType) {
        return getContentDetailPath(d.contentType, n.entity_id);
      }
      if (n.entity_type === 'content_answer' && d.contentId && d.contentType) {
        return getContentDetailPath(d.contentType, d.contentId);
      }
      const hubPath = hubDetailPath(n.entity_type, n.entity_id, d);
      if (hubPath) return hubPath;
      if (n.entity_type === 'community_post') return `/community-posts/${n.entity_id}`;
      if (n.entity_type === 'news_post') {
        return d.newsSlug ? `/news/${d.newsSlug}` : `/news/${n.entity_id}`;
      }
      return '/hub';
    }
    default: {
      if (n.entity_type === 'news_post') {
        return n.news_slug ? `/news/${n.news_slug}` : `/news/${n.entity_id}`;
      }
      if (n.content_type && n.entity_type === 'content') {
        return getContentDetailPath(n.content_type, n.entity_id);
      }
      const hubPath = hubDetailPath(n.entity_type, n.entity_id, d);
      if (hubPath) return hubPath;
      if (n.entity_type === 'community_post') return `/community-posts/${n.entity_id}`;
      if (n.entity_type === 'community' && (n.community_slug || d.slug)) {
        return `/communities/${n.community_slug || d.slug}`;
      }
      return '/notifications';
    }
  }
}

export function notificationIcon(type) {
  const map = {
    question_answer: '💬',
    question_activity: '🔔',
    answer_accepted: '✅',
    vote: '👍',
    question_bookmark: '🔖',
    community_post_comment: '💬',
    community_post_reply: '↩️',
    community_thread_activity: '🧵',
    community_new_post: '📌',
    community_join: '👋',
    community_welcome: '🎉',
    community_post_status: '📋',
    hub_linked_in_post: '🔗',
    news_post_comment: '📰',
    news_comment_reply: '↩️',
    news_thread_activity: '🧵',
    news_published: '📢',
  };
  return map[type] || '•';
}

export function notificationLabel(n) {
  const who = n.actor_name || 'Користувач';
  const titlePart = notificationContextTitle(n);
  const titleSuffix = titlePart ? `: ${titlePart}` : '';
  const d = parseNotificationData(n.data);

  switch (n.type) {
    case 'question_answer':
      return `${who} відповів на ваше питання${titleSuffix}`;
    case 'question_activity':
      return `${who} теж відповів на питання${titleSuffix}, де ви брали участь`;
    case 'answer_accepted':
      return `Вашу відповідь позначено як прийняту${titleSuffix}`;
    case 'vote':
      if (n.entity_type === 'content') return `${who} оцінив ваш матеріал у хабі${titleSuffix}`;
      if (n.entity_type === 'content_answer') return `${who} оцінив вашу відповідь у хабі${titleSuffix}`;
      if (HUB_ENTITY_TYPES.has(n.entity_type) || HUB_ENTITY_TYPES.has(d.hubType)) {
        const hubType = d.hubType || n.entity_type;
        const what = HUB_VOTE_LABEL[hubType] || 'матеріал';
        return `${who} проголосував «за» вашу ${what}${titleSuffix}`;
      }
      if (n.entity_type === 'community_post') {
        return `${who} проголосував «за» ваш пост у спільноті${titleSuffix}`;
      }
      if (n.entity_type === 'news_post') {
        return `${who} проголосував «за» вашу новину${titleSuffix}`;
      }
      return `${who} проголосував «за»${n.entity_type === 'answer' ? ' відповідь' : ' ваше питання'}${titleSuffix}`;
    case 'question_bookmark':
      return `${who} додав ваше питання в закладки${titleSuffix}`;
    case 'community_post_comment':
      return `${who} прокоментував ваш пост у спільноті${titleSuffix}`;
    case 'community_post_reply':
      return `${who} відповів на ваш коментар у пості${titleSuffix}`;
    case 'community_thread_activity':
      return `${who} додав коментар у треді посту${titleSuffix}`;
    case 'community_new_post': {
      const comm = d.communityName ? ` «${d.communityName}»` : '';
      return `${who} опублікував новий пост у спільноті${comm}${titleSuffix}`;
    }
    case 'community_join': {
      const commName = d.communityName || n.context_title;
      const comm = commName ? ` «${commName}»` : '';
      return `${who} приєднався до вашої спільноти${comm}`;
    }
    case 'community_welcome': {
      const comm = d.communityName || n.context_title;
      return `Ви приєдналися до спільноти${comm ? ` «${comm}»` : titleSuffix}`;
    }
    case 'community_post_status': {
      const st = d.status === 'filled' ? 'виконано' : 'закрито';
      const by = who && d.actorId && d.actorId !== n.user_id ? ` (${who})` : '';
      return `Пост${titleSuffix} позначено як ${st}${by}`;
    }
    case 'hub_linked_in_post': {
      const hub = d.linkedContentType ? ` (${d.linkedContentType})` : '';
      return `${who} посилається на ваш матеріал у пості спільноти${hub}${titleSuffix}`;
    }
    case 'news_post_comment':
      return `${who} прокоментував вашу новину${titleSuffix}`;
    case 'news_comment_reply':
      return `${who} відповів на ваш коментар до новини${titleSuffix}`;
    case 'news_thread_activity':
      return `${who} додав коментар у треді новини${titleSuffix}`;
    case 'news_published':
      return `Опубліковано вашу новину${titleSuffix}`;
    default:
      return `Подія: ${n.type}${titleSuffix}`;
  }
}

export function notificationTypeName(type) {
  const names = {
    question_answer: 'Відповідь',
    question_activity: 'Активність',
    answer_accepted: 'Прийнято',
    vote: 'Голос',
    question_bookmark: 'Закладка',
    community_post_comment: 'Коментар',
    community_post_reply: 'Відповідь',
    community_thread_activity: 'Тред',
    community_new_post: 'Пост',
    community_join: 'Учасник',
    community_welcome: 'Вітаємо',
    community_post_status: 'Статус',
    hub_linked_in_post: 'Посилання',
    news_post_comment: 'Новини',
    news_comment_reply: 'Відповідь',
    news_thread_activity: 'Тред',
    news_published: 'Публікація',
  };
  return names[type] || type;
}
