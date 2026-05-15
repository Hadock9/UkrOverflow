/**
 * Тексти та посилання для сповіщень (синхронно з backend Notification).
 */

import { getContentDetailPath } from '@ukroverflow/shared';

export function parseNotificationData(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
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
    case 'vote':
      if (n.entity_type === 'question') return `/questions/${n.entity_id}`;
      if (n.entity_type === 'answer' && d.questionId) return `/questions/${d.questionId}`;
      if (n.entity_type === 'content' && d.contentType) {
        return getContentDetailPath(d.contentType, n.entity_id);
      }
      if (n.entity_type === 'content_answer' && d.contentId && d.contentType) {
        return getContentDetailPath(d.contentType, d.contentId);
      }
      return '/hub';
    default:
      if (n.entity_type === 'news_post') {
        return n.news_slug ? `/news/${n.news_slug}` : `/news/${n.entity_id}`;
      }
      if (n.content_type && n.entity_type === 'content') {
        return getContentDetailPath(n.content_type, n.entity_id);
      }
      return '/notifications';
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
  const t = n.context_title || n.question_title || parseNotificationData(n.data).title;
  const titlePart = t ? `: «${t}»` : '';
  const d = parseNotificationData(n.data);

  switch (n.type) {
    case 'question_answer':
      return `${who} відповів на ваше питання${titlePart}`;
    case 'question_activity':
      return `${who} теж відповів на питання${titlePart}, де ви брали участь`;
    case 'answer_accepted':
      return `Вашу відповідь позначено як прийняту${titlePart}`;
    case 'vote':
      if (n.entity_type === 'content') return `${who} оцінив ваш матеріал у хабі${titlePart}`;
      if (n.entity_type === 'content_answer') return `${who} оцінив вашу відповідь у хабі`;
      return `${who} проголосував «за»${n.entity_type === 'answer' ? ' за відповідь' : ' за ваше питання'}${titlePart}`;
    case 'question_bookmark':
      return `${who} додав ваше питання в закладки${titlePart}`;
    case 'community_post_comment':
      return `${who} прокоментував ваш пост у спільноті${titlePart}`;
    case 'community_post_reply':
      return `${who} відповів на ваш коментар${titlePart}`;
    case 'community_thread_activity':
      return `Нова активність у треді посту${titlePart} — ${who}`;
    case 'community_new_post':
      return `${who} опублікував пост у спільноті${d.communityName ? ` «${d.communityName}»` : ''}${titlePart}`;
    case 'community_join':
      return `${who} приєднався до спільноти${titlePart}`;
    case 'community_welcome':
      return `Ви приєдналися до спільноти${titlePart || (d.communityName ? ` «${d.communityName}»` : '')}`;
    case 'community_post_status': {
      const st = d.status === 'filled' ? 'виконано' : 'закрито';
      return `Пост${titlePart} позначено як ${st}${who && d.actorId ? ` (${who})` : ''}`;
    }
    case 'hub_linked_in_post': {
      const hub = d.linkedContentType ? ` (${d.linkedContentType})` : '';
      return `${who} посилається на ваш матеріал у пості спільноти${hub}${titlePart}`;
    }
    case 'news_post_comment':
      return `${who} прокоментував вашу новину${titlePart}`;
    case 'news_comment_reply':
      return `${who} відповів на ваш коментар до новини${titlePart}`;
    case 'news_thread_activity':
      return `Нова активність у коментарях новини${titlePart} — ${who}`;
    case 'news_published':
      return `Опубліковано вашу новину${titlePart}`;
    default:
      return `Подія: ${n.type}${titlePart}`;
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
