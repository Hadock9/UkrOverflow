/**
 * Головна сторінка - список питань
 */

import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMediator } from '../contexts/MediatorContext';
import { EventTypes } from '../../../mediator/src/index';
import { api } from '../services/api';
import '../styles/brutalism.css';

export function Home() {
  const { tag } = useParams();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('created_at');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const mediator = useMediator();

  useEffect(() => {
    mediator.emit(EventTypes.PAGE_VIEW, { page: 'home', tag }, 'Home');
    loadQuestions();
  }, [sortBy, page, tag]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      mediator.emit(EventTypes.API_REQUEST, { endpoint: '/questions', tag }, 'Home');

      const response = await api.get('/questions', {
        params: { sortBy, page, limit: 20, tag }
      });

      // API повертає { success, data: { questions, pagination } }
      const { questions: questionsData, pagination } = response.data.data || response.data;

      setQuestions(questionsData || []);
      setTotalPages(pagination?.totalPages || 1);
      setTotal(pagination?.total || 0);

      mediator.emit(EventTypes.API_SUCCESS, {
        endpoint: '/questions',
        count: questionsData?.length || 0
      }, 'Home');
    } catch (error) {
      mediator.emit(EventTypes.API_ERROR, {
        endpoint: '/questions',
        error: error.message
      }, 'Home');
      console.error('Помилка завантаження питань:', error);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // секунди

    if (diff < 60) return `${diff} сек тому`;
    if (diff < 3600) return `${Math.floor(diff / 60)} хв тому`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} год тому`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} дн тому`;

    return date.toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="container">
      {/* Заголовок та кнопка створення */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{tag ? `ПИТАННЯ З ТЕГОМ: ${tag}` : 'ПИТАННЯ'}</h1>
          <p className="page-subtitle">
            {tag && total === 0 ? 'Питань з цим тегом не знайдено' : `Всього питань: ${total}`}
          </p>
        </div>
        <Link to="/questions/new" className="btn btn-primary">
          + НОВЕ ПИТАННЯ
        </Link>
      </div>

      {/* Фільтри */}
      <div className="filters">
        <button
          className={`filter-btn ${sortBy === 'created_at' ? 'active' : ''}`}
          onClick={() => setSortBy('created_at')}
        >
          НОВІ
        </button>
        <button
          className={`filter-btn ${sortBy === 'votes' ? 'active' : ''}`}
          onClick={() => setSortBy('votes')}
        >
          ПОПУЛЯРНІ
        </button>
        <button
          className={`filter-btn ${sortBy === 'views' ? 'active' : ''}`}
          onClick={() => setSortBy('views')}
        >
          ПЕРЕГЛЯНУТІ
        </button>
      </div>

      {/* Список питань */}
      {loading ? (
        <div className="loading">ЗАВАНТАЖЕННЯ...</div>
      ) : questions.length === 0 ? (
        <div className="empty-state">
          <p>ПИТАНЬ ПОКИ НЕМАЄ</p>
          <Link to="/questions/new" className="btn btn-primary">
            СТВОРИТИ ПЕРШЕ ПИТАННЯ
          </Link>
        </div>
      ) : (
        <div className="questions-list">
          {questions.map((question) => (
            <div key={question.id} className="question-card">
              {/* Статистика зліва */}
              <div className="question-stats">
                <div className="stat">
                  <div className="stat-value">{question.votes || 0}</div>
                  <div className="stat-label">ГОЛОСИ</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{question.answers_count || 0}</div>
                  <div className="stat-label">ВІДПОВІДІ</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{question.views || 0}</div>
                  <div className="stat-label">ПЕРЕГЛЯДИ</div>
                </div>
              </div>

              {/* Контент питання */}
              <div className="question-content">
                <Link to={`/questions/${question.id}`} className="question-title">
                  {question.title}
                </Link>
                <p className="question-excerpt">
                  {question.body.substring(0, 200)}
                  {question.body.length > 200 ? '...' : ''}
                </p>

                {/* Теги */}
                <div className="question-tags">
                  {Array.isArray(question.tags) && question.tags.map((tag, index) => (
                    <Link
                      key={index}
                      to={`/tags/${tag}`}
                      className="tag"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>

                {/* Мета інформація */}
                <div className="question-meta">
                  <Link to={`/users/${question.author_id}`} className="author">
                    {question.author_name}
                  </Link>
                  <span className="separator">•</span>
                  <span className="date">{formatDate(question.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Пагінація */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-secondary"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            ← ПОПЕРЕДНЯ
          </button>
          <span className="page-info">
            СТОРІНКА {page} З {totalPages}
          </span>
          <button
            className="btn btn-secondary"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            НАСТУПНА →
          </button>
        </div>
      )}
    </div>
  );
}
