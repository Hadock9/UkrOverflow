/**
 * API Client для UkrOverflow
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3338';

const VISITOR_STORAGE_KEY = 'ukroverflow_visitor_id';

function ensureVisitorId() {
  if (typeof localStorage === 'undefined') return null;
  let id = localStorage.getItem(VISITOR_STORAGE_KEY);
  if (!id && globalThis.crypto?.randomUUID) {
    id = globalThis.crypto.randomUUID();
    localStorage.setItem(VISITOR_STORAGE_KEY, id);
  }
  return id;
}

const api = axios.create({
  baseURL: `${API_URL}/api`,
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

// Stats
export const stats = {
  overview: () => api.get('/stats/overview'),
  topUsers: (limit) => api.get('/stats/top-users', { params: { limit } }),
  topTags: (limit) => api.get('/stats/top-tags', { params: { limit } }),
  recentActivity: (limit) => api.get('/stats/recent-activity', { params: { limit } }),
  unanswered: (limit) => api.get('/stats/unanswered', { params: { limit } })
};

// Експорт API клієнта
export { api };
export default api;
