/**
 * API Client для UkrOverflow
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3338';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor для додавання токену
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
