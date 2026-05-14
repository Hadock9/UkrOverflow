/**
 * Сторінка профілю користувача (особистий кабінет)
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMediator } from '../contexts/MediatorContext';
import { EventTypes } from '../../../mediator/src/index';
import { api } from '../services/api';
import '../styles/brutalism.css';

export function Profile() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const mediator = useMediator();

  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('questions');

  const userId = id || currentUser?.id;
  const isOwnProfile = currentUser && currentUser.id === parseInt(userId);

  useEffect(() => {
    if (!userId) {
      navigate('/login');
      return;
    }

    loadProfile();
    loadQuestions();
    loadAnswers();
  }, [userId]);

  const loadProfile = async () => {
    try {
      mediator.emit(EventTypes.API_REQUEST, { endpoint: `/users/${userId}` }, 'Profile');

      const response = await api.get(`/users/${userId}`);
      const userData = response.data.data?.user || response.data.user || response.data;
      setUser(userData);

      mediator.emit(EventTypes.API_SUCCESS, { endpoint: `/users/${userId}` }, 'Profile');
    } catch (error) {
      console.error('Помилка завантаження профілю:', error);
      mediator.emit(EventTypes.API_ERROR, {
        endpoint: `/users/${userId}`,
        error: error.message
      }, 'Profile');
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async () => {
    try {
      const response = await api.get('/questions', {
        params: { authorId: userId, limit: 100 }
      });
      const { questions: questionsData } = response.data.data || response.data;
      setQuestions(questionsData || []);
    } catch (error) {
      console.error('Помилка завантаження питань:', error);
    }
  };

  const loadAnswers = async () => {
    try {
      const response = await api.get('/answers', {
        params: { authorId: userId, limit: 100 }
      });
      const answersData = response.data.data?.answers || response.data.answers || response.data;
      setAnswers(Array.isArray(answersData) ? answersData : []);
    } catch (error) {
      console.error('Помилка завантаження відповідей:', error);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!confirm('Ви впевнені, що хочете видалити це питання?')) {
      return;
    }

    try {
      await api.delete(`/questions/${questionId}`);
      loadQuestions();
      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'success',
        message: 'Питання видалено'
      }, 'Profile');
    } catch (error) {
      console.error('Помилка видалення питання:', error);
      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'error',
        message: error.response?.data?.message || 'Помилка видалення питання'
      }, 'Profile');
    }
  };

  const handleDeleteAnswer = async (answerId) => {
    if (!confirm('Ви впевнені, що хочете видалити цю відповідь?')) {
      return;
    }

    try {
      await api.delete(`/answers/${answerId}`);
      loadAnswers();
      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'success',
        message: 'Відповідь видалено'
      }, 'Profile');
    } catch (error) {
      console.error('Помилка видалення відповіді:', error);
      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'error',
        message: error.response?.data?.message || 'Помилка видалення відповіді'
      }, 'Profile');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;
  }

  if (!user) {
    return (
      <div className="container">
        <div className="error">КОРИСТУВАЧА НЕ ЗНАЙДЕНО</div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Заголовок профілю */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{user.username}</h1>
          <p className="page-subtitle">
            Користувач з {formatDate(user.created_at)}
          </p>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-4" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="card">
          <div className="stat">
            <div className="stat-value" style={{ color: 'var(--color-success)' }}>
              {user.reputation || 0}
            </div>
            <div className="stat-label">РЕПУТАЦІЯ</div>
          </div>
        </div>
        <div className="card">
          <div className="stat">
            <div className="stat-value">{user.questions_count || 0}</div>
            <div className="stat-label">ПИТАНЬ</div>
          </div>
        </div>
        <div className="card">
          <div className="stat">
            <div className="stat-value">{user.answers_count || 0}</div>
            <div className="stat-label">ВІДПОВІДЕЙ</div>
          </div>
        </div>
        <div className="card">
          <div className="stat">
            <div className="stat-value">
              {user.role === 'admin' ? (
                <span className="badge badge-primary">АДМІН</span>
              ) : (
                <span className="badge">КОРИСТУВАЧ</span>
              )}
            </div>
            <div className="stat-label">РОЛЬ</div>
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="filters">
        <button
          className={`filter-btn ${activeTab === 'questions' ? 'active' : ''}`}
          onClick={() => setActiveTab('questions')}
        >
          ПИТАННЯ ({questions.length})
        </button>
        <button
          className={`filter-btn ${activeTab === 'answers' ? 'active' : ''}`}
          onClick={() => setActiveTab('answers')}
        >
          ВІДПОВІДІ ({answers.length})
        </button>
      </div>

      {/* Вміст вкладок */}
      {activeTab === 'questions' && (
        <div className="questions-list">
          {questions.length === 0 ? (
            <div className="empty-state">
              <p>{isOwnProfile ? 'Ви ще не задали жодного питання' : 'Користувач не задав жодного питання'}</p>
              {isOwnProfile && (
                <Link to="/questions/new" className="btn btn-primary">
                  + ЗАДАТИ ПИТАННЯ
                </Link>
              )}
            </div>
          ) : (
            questions.map((question) => (
              <div key={question.id} className="question-card">
                <div className="question-stats">
                  <div className="stat">
                    <div className="stat-value">{question.votes || 0}</div>
                    <div className="stat-label">ГОЛОСІВ</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value" style={{ color: question.answers_count > 0 ? 'var(--color-success)' : 'inherit' }}>
                      {question.answers_count || 0}
                    </div>
                    <div className="stat-label">ВІДПОВІДЕЙ</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">{question.views || 0}</div>
                    <div className="stat-label">ПЕРЕГЛЯДІВ</div>
                  </div>
                </div>

                <div className="question-content">
                  <Link to={`/questions/${question.id}`} className="question-title">
                    {question.title}
                  </Link>

                  {Array.isArray(question.tags) && question.tags.length > 0 && (
                    <div className="question-tags">
                      {question.tags.map((tag, index) => (
                        <Link key={index} to={`/tags/${tag}`} className="tag">
                          {tag}
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="question-meta">
                    <span className="date">Створено {formatDate(question.created_at)}</span>
                    {isOwnProfile && (
                      <div className="question-actions" style={{ marginLeft: 'auto' }}>
                        <Link
                          to={`/questions/${question.id}/edit`}
                          className="btn btn-secondary btn-sm"
                        >
                          РЕДАГУВАТИ
                        </Link>
                        <button
                          onClick={() => handleDeleteQuestion(question.id)}
                          className="btn btn-danger btn-sm"
                        >
                          ВИДАЛИТИ
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'answers' && (
        <div className="questions-list">
          {answers.length === 0 ? (
            <div className="empty-state">
              <p>{isOwnProfile ? 'Ви ще не дали жодної відповіді' : 'Користувач не дав жодної відповіді'}</p>
            </div>
          ) : (
            answers.map((answer) => (
              <div key={answer.id} className="question-card">
                <div className="question-stats">
                  <div className="stat">
                    <div className="stat-value">
                      {(answer.upvotes || 0) - (answer.downvotes || 0)}
                    </div>
                    <div className="stat-label">ГОЛОСІВ</div>
                  </div>
                  {answer.is_accepted && (
                    <div className="stat">
                      <div className="stat-value" style={{ color: 'var(--color-success)' }}>✓</div>
                      <div className="stat-label">ПРИЙНЯТО</div>
                    </div>
                  )}
                </div>

                <div className="question-content">
                  <Link to={`/questions/${answer.question_id}`} className="question-title">
                    Відповідь на питання
                  </Link>

                  <div className="question-excerpt">
                    {answer.body.substring(0, 200)}{answer.body.length > 200 ? '...' : ''}
                  </div>

                  <div className="question-meta">
                    <span className="date">Створено {formatDate(answer.created_at)}</span>
                    {isOwnProfile && (
                      <div className="question-actions" style={{ marginLeft: 'auto' }}>
                        <button
                          onClick={() => handleDeleteAnswer(answer.id)}
                          className="btn btn-danger btn-sm"
                        >
                          ВИДАЛИТИ
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
