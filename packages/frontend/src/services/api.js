/**
 * API Client для DevFlow
 */

import axios from 'axios';

/**
 * Порожній VITE_API_URL = той самий origin (деплой за nginx: /api проксується на бекенд).
 * Не задано / null = локальна розробка на :3338.
 */
const raw = import.meta.env.VITE_API_URL;
export const apiBaseUrl = raw === ''
  ? ''
  : (raw == null ? 'http://localhost:3338' : String(raw).replace(/\/$/, ''));
const API_URL = apiBaseUrl;
export function githubLoginUrl({ link = false, token = null } = {}) {
  const params = new URLSearchParams();
  if (link) params.set('link', '1');
  if (token) params.set('as', token);
  const qs = params.toString();
  return `${API_URL}/api/auth/github${qs ? `?${qs}` : ''}`;
}

const VISITOR_STORAGE_KEY = 'ukroverflow_visitor_id';

/** Так само, як UUID_STRING на бекенді — щоб анонімний перегляд завжди мав валідний ключ. */
function isValidVisitorUuid(s) {
  return typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim());
}

function generateVisitorUuid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  // RFC 4122 v4 (fallback для середовищ без Web Crypto API)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function ensureVisitorId() {
  if (typeof localStorage === 'undefined') return null;
  let id = localStorage.getItem(VISITOR_STORAGE_KEY);
  if (!id || !isValidVisitorUuid(id)) {
    id = generateVisitorUuid();
    localStorage.setItem(VISITOR_STORAGE_KEY, id);
  }
  return id;
}

const api = axios.create({
  baseURL: API_URL === '' ? '/api' : `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor: JWT + резервний X-Visitor-Id (якщо токен прострочений, бекенд усе одно зможе ідентифікувати гостя)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const vid = ensureVisitorId();
  if (vid) {
    config.headers['X-Visitor-Id'] = vid;
  }
  return config;
});

// Interceptor для обробки помилок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth
export const auth = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data)
};

// Questions
export const questions = {
  list: (params) => api.get('/questions', { params }),
  get: (id) => api.get(`/questions/${id}`),
  create: (data) => api.post('/questions', data),
  update: (id, data) => api.put(`/questions/${id}`, data),
  delete: (id) => api.delete(`/questions/${id}`),
  getTags: () => api.get('/questions/tags/all')
};

// Answers
export const answers = {
  list: (questionId) => api.get('/answers', { params: { questionId } }),
  create: (data) => api.post('/answers', data),
  update: (id, data) => api.put(`/answers/${id}`, data),
  delete: (id) => api.delete(`/answers/${id}`),
  accept: (id) => api.post(`/answers/${id}/accept`)
};

// Votes
export const votes = {
  vote: (data) => api.post('/votes', data),
  getVotes: (entityType, entityId) => api.get(`/votes/${entityType}/${entityId}`)
};

// Search
export const search = {
  search: (query, params) => api.get('/search', { params: { q: query, ...params } }),
  global: (query, params) => api.get('/search/global', { params: { q: query, ...params } }),
  suggestions: (query) => api.get('/search/suggestions', { params: { q: query } })
};

// AI Features
export const ai = {
  // Генерація підказки для відповіді (Gemini Pro)
  suggestAnswer: (questionId) => api.post('/ai/suggest-answer', { questionId }),

  // Автоматичний підбір тегів (Gemini Flash)
  suggestTags: (title, body) => api.post('/ai/suggest-tags', { title, body }),

  // Модерація контенту (Gemini Flash)
  moderateContent: (text, type = 'question') => api.post('/ai/moderate', { text, type }),

  // Створення резюме для довгих питань (Gemini Flash)
  summarizeQuestion: (questionId) => api.post('/ai/summarize', { questionId }),

  // Пошук схожих питань (Gemini Flash)
  findSimilarQuestions: (questionId) => api.get(`/ai/similar-questions/${questionId}`),

  // Статус AI сервісу
  status: () => api.get('/ai/status')
};

// Notifications
export const notifications = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`)
};

// Bookmarks
export const bookmarks = {
  getAll: (params) => api.get('/bookmarks', { params }),
  add: (questionId) => api.post(`/bookmarks/${questionId}`),
  remove: (questionId) => api.delete(`/bookmarks/${questionId}`),
  check: (questionId) => api.get(`/bookmarks/check/${questionId}`)
};

// Knowledge hub: уніфікований фід
export const content = {
  list: (params) => api.get('/content', { params }),
};

// Articles
export const articles = {
  list: (params) => api.get('/articles', { params }),
  get: (id) => api.get(`/articles/${id}`),
  create: (data) => api.post('/articles', data),
  update: (id, data) => api.put(`/articles/${id}`, data),
  delete: (id) => api.delete(`/articles/${id}`),
  getTags: () => api.get('/articles/tags/all'),
};

// Guides
export const guides = {
  list: (params) => api.get('/guides', { params }),
  get: (id) => api.get(`/guides/${id}`),
  create: (data) => api.post('/guides', data),
  update: (id, data) => api.put(`/guides/${id}`, data),
  delete: (id) => api.delete(`/guides/${id}`),
  getTags: () => api.get('/guides/tags/all'),
};

// Snippets
export const snippets = {
  list: (params) => api.get('/snippets', { params }),
  get: (id) => api.get(`/snippets/${id}`),
  create: (data) => api.post('/snippets', data),
  update: (id, data) => api.put(`/snippets/${id}`, data),
  delete: (id) => api.delete(`/snippets/${id}`),
  getTags: () => api.get('/snippets/tags/all'),
};

// Roadmaps
export const roadmaps = {
  list: (params) => api.get('/roadmaps', { params }),
  get: (id) => api.get(`/roadmaps/${id}`),
  create: (data) => api.post('/roadmaps', data),
  update: (id, data) => api.put(`/roadmaps/${id}`, data),
  delete: (id) => api.delete(`/roadmaps/${id}`),
  getTags: () => api.get('/roadmaps/tags/all'),
};

// Best practices
export const bestPractices = {
  list: (params) => api.get('/best-practices', { params }),
  get: (id) => api.get(`/best-practices/${id}`),
  create: (data) => api.post('/best-practices', data),
  update: (id, data) => api.put(`/best-practices/${id}`, data),
  delete: (id) => api.delete(`/best-practices/${id}`),
  getTags: () => api.get('/best-practices/tags/all'),
};

// FAQs
export const faqs = {
  list: (params) => api.get('/faqs', { params }),
  get: (id) => api.get(`/faqs/${id}`),
  create: (data) => api.post('/faqs', data),
  update: (id, data) => api.put(`/faqs/${id}`, data),
  delete: (id) => api.delete(`/faqs/${id}`),
  getTags: () => api.get('/faqs/tags/all'),
};

// GitHub integration
export const github = {
  status: () => api.get('/auth/github/status'),
  sync: () => api.post('/github/sync'),
  myRepos: (params) => api.get('/github/me/repos', { params }),
  pin: (repoIds) => api.post('/github/me/pin', { repoIds }),
  unlink: () => api.post('/auth/github/unlink'),
  userProfile: (userId) => api.get(`/github/users/${userId}/profile`),
  userRepos: (userId, params) => api.get(`/github/users/${userId}/repos`, { params }),
  listLinks: (targetType, targetId, params) => api.get(`/github/links/${targetType}/${targetId}`, { params }),
  addLink: (data) => api.post('/github/links', data),
  removeLink: (id) => api.delete(`/github/links/${id}`),
};

// Stats
export const stats = {
  overview: () => api.get('/stats/overview'),
  topUsers: (limit) => api.get('/stats/top-users', { params: { limit } }),
  topTags: (limit) => api.get('/stats/top-tags', { params: { limit } }),
  recentActivity: (limit) => api.get('/stats/recent-activity', { params: { limit } }),
  unanswered: (limit) => api.get('/stats/unanswered', { params: { limit } })
};

// Communities
export const communities = {
  list: (params) => api.get('/communities', { params }),
  get: (slug) => api.get(`/communities/${slug}`),
  create: (data) => api.post('/communities', data),
  update: (id, data) => api.put(`/communities/${id}`, data),
  delete: (id) => api.delete(`/communities/${id}`),
  join: (id) => api.post(`/communities/${id}/join`),
  leave: (id) => api.post(`/communities/${id}/leave`),
  members: (id, params) => api.get(`/communities/${id}/members`, { params }),
};

// Community posts
export const communityPosts = {
  list: (params) => api.get('/community-posts', { params }),
  get: (id, opts) => api.get(`/community-posts/${id}`, opts),
  create: (data) => api.post('/community-posts', data),
  update: (id, data) => api.put(`/community-posts/${id}`, data),
  delete: (id) => api.delete(`/community-posts/${id}`),
  close: (id, status) => api.post(`/community-posts/${id}/close`, { status }),
  listComments: (id) => api.get(`/community-posts/${id}/comments`),
  addComment: (id, data) => api.post(`/community-posts/${id}/comments`, data),
  deleteComment: (commentId) => api.delete(`/community-posts/comments/${commentId}`),
  forQuestion: (questionId, params) => api.get(`/community-posts/for-question/${questionId}`, { params }),
};

// Mentors
export const mentors = {
  list: (params) => api.get('/mentors', { params }),
  me: () => api.get('/mentors/me'),
  upsertMe: (data) => api.put('/mentors/me', data),
  deleteMe: () => api.delete('/mentors/me'),
  byUser: (userId) => api.get(`/mentors/${userId}`),
};

// Users search (за стеком/локацією/q)
export const usersSearch = (params) => api.get('/users/search', { params });

// Експорт API клієнта
export { api };
export default api;
