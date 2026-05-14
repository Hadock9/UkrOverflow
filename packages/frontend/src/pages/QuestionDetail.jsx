/**
 * Сторінка перегляду питання з відповідями
 */

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useMediator } from '../contexts/MediatorContext';
import { useAuth } from '../contexts/AuthContext';
import { EventTypes } from '../../../mediator/src/index';
import { api } from '../services/api';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { AIAssistant } from '../components/AIAssistant';
import { AISimilarQuestions } from '../components/AISimilarQuestions';
import { AIQuestionSummary } from '../components/AIQuestionSummary';
import '../styles/brutalism.css';

export function QuestionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const mediator = useMediator();
  const { user } = useAuth();

  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answerBody, setAnswerBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadQuestion();
    loadAnswers();
  }, [id]);

  const loadQuestion = async () => {
    setLoading(true);
    try {
      mediator.emit(EventTypes.API_REQUEST, { endpoint: `/questions/${id}` }, 'QuestionDetail');

      const response = await api.get(`/questions/${id}`);
      const questionData = response.data.data?.question || response.data.question || response.data;
      setQuestion(questionData);

      mediator.emit(EventTypes.API_SUCCESS, { endpoint: `/questions/${id}` }, 'QuestionDetail');
    } catch (error) {
      mediator.emit(EventTypes.API_ERROR, {
        endpoint: `/questions/${id}`,
        error: error.message
      }, 'QuestionDetail');
      console.error('Помилка завантаження питання:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnswers = async () => {
    try {
      const response = await api.get(`/questions/${id}/answers`);
      const answersData = response.data.data || response.data;
      setAnswers(Array.isArray(answersData) ? answersData : []);
    } catch (error) {
      console.error('Помилка завантаження відповідей:', error);
      setAnswers([]);
    }
  };

  const handleVote = async (type, entityType, entityId) => {
    if (!user) {
      alert('Увійдіть, щоб голосувати');
      return;
    }

    try {
      mediator.emit(EventTypes.USER_ACTION, {
        action: 'vote',
        type,
        entityType,
        entityId
      }, 'QuestionDetail');

      await api.post('/votes', {
        entityType,
        entityId,
        voteType: type
      });

      // Оновити дані
      if (entityType === 'question') {
        loadQuestion();
      } else {
        loadAnswers();
      }

      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'success',
        message: 'Голос враховано'
      }, 'QuestionDetail');
    } catch (error) {
      console.error('Помилка голосування:', error);
      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'error',
        message: error.response?.data?.message || 'Помилка голосування'
      }, 'QuestionDetail');
    }
  };

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();

    if (!user) {
      alert('Увійдіть, щоб відповісти');
      return;
    }

    if (!answerBody.trim()) {
      alert('Введіть текст відповіді');
      return;
    }

    setSubmitting(true);
    try {
      mediator.emit(EventTypes.USER_ACTION, {
        action: 'create_answer',
        questionId: id
      }, 'QuestionDetail');

      const response = await api.post('/answers', {
        body: answerBody,
        questionId: parseInt(id)
      });

      const newAnswer = response.data.data?.answer || response.data.answer || response.data;
      setAnswers([...answers, newAnswer]);
      setAnswerBody('');

      mediator.emit(EventTypes.ANSWER_CREATE, {
        answerId: newAnswer.id,
        questionId: id
      }, 'QuestionDetail');

      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'success',
        message: 'Відповідь додано'
      }, 'QuestionDetail');
    } catch (error) {
      console.error('Помилка створення відповіді:', error);
      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'error',
        message: error.response?.data?.message || 'Помилка створення відповіді'
      }, 'QuestionDetail');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptAnswer = async (answerId) => {
    try {
      await api.put(`/answers/${answerId}/accept`);
      loadAnswers();

      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'success',
        message: 'Відповідь прийнято'
      }, 'QuestionDetail');
    } catch (error) {
      console.error('Помилка прийняття відповіді:', error);
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
      }, 'QuestionDetail');
    } catch (error) {
      console.error('Помилка видалення відповіді:', error);
      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'error',
        message: error.response?.data?.message || 'Помилка видалення відповіді'
      }, 'QuestionDetail');
    }
  };

  const handleDeleteQuestion = async () => {
    if (!confirm('Ви впевнені, що хочете видалити це питання?')) {
      return;
    }

    try {
      await api.delete(`/questions/${id}`);
      navigate('/');

      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'success',
        message: 'Питання видалено'
      }, 'QuestionDetail');
    } catch (error) {
      console.error('Помилка видалення питання:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderMarkdown = (text) => {
    if (!text || typeof text !== 'string') {
      return { __html: '' };
    }
    const rawHtml = marked(text);
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    return { __html: cleanHtml };
  };

  if (loading) {
    return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;
  }

  if (!question) {
    return <div className="container"><div className="error">ПИТАННЯ НЕ ЗНАЙДЕНО</div></div>;
  }

  return (
    <div className="container">
      {/* Заголовок питання */}
      <div className="question-header">
        <h1 className="question-detail-title">{question.title}</h1>
        <div className="question-info">
          <span>Створено: {formatDate(question.created_at)}</span>
          <span>•</span>
          <span>Переглядів: {question.views}</span>
        </div>
      </div>

      {/* Тіло питання */}
      <div className="question-detail-card">
        <div className="vote-section">
          <button
            className="vote-btn vote-up"
            onClick={() => handleVote('up', 'question', question.id)}
            disabled={!user}
          >
            ▲
          </button>
          <div className="vote-count">{question.votes || 0}</div>
          <button
            className="vote-btn vote-down"
            onClick={() => handleVote('down', 'question', question.id)}
            disabled={!user}
          >
            ▼
          </button>
        </div>

        <div className="question-detail-content">
          {/* AI Summary для довгих питань */}
          <AIQuestionSummary
            questionId={question.id}
            bodyLength={question.body ? question.body.length : 0}
          />

          <div
            className="markdown-content"
            dangerouslySetInnerHTML={renderMarkdown(question.body)}
          />

          {/* Теги */}
          <div className="question-tags">
            {Array.isArray(question.tags) && question.tags.map((tag, index) => (
              <Link key={index} to={`/tags/${tag}`} className="tag">
                {tag}
              </Link>
            ))}
          </div>

          {/* Автор */}
          <div className="question-author">
            <div className="author-info">
              <Link to={`/users/${question.author_id}`} className="author-name">
                {question.author_name}
              </Link>
              <span className="author-date">{formatDate(question.created_at)}</span>
            </div>
            {user && (user.id === question.author_id || user.role === 'admin') && (
              <div className="question-actions">
                {user.id === question.author_id && (
                  <Link to={`/questions/${id}/edit`} className="btn btn-secondary btn-sm">
                    РЕДАГУВАТИ
                  </Link>
                )}
                <button onClick={handleDeleteQuestion} className="btn btn-danger btn-sm">
                  ВИДАЛИТИ
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Відповіді */}
      <div className="answers-section">
        <h2 className="section-title">
          {Array.isArray(answers) ? answers.length : 0} {Array.isArray(answers) && answers.length === 1 ? 'ВІДПОВІДЬ' : 'ВІДПОВІДЕЙ'}
        </h2>

        {Array.isArray(answers) && answers.map((answer) => (
          <div key={answer.id} className={`answer-card ${answer.is_accepted ? 'accepted' : ''}`}>
            <div className="vote-section">
              <button
                className="vote-btn vote-up"
                onClick={() => handleVote('up', 'answer', answer.id)}
                disabled={!user}
              >
                ▲
              </button>
              <div className="vote-count">
                {(answer.upvotes || 0) - (answer.downvotes || 0)}
              </div>
              <button
                className="vote-btn vote-down"
                onClick={() => handleVote('down', 'answer', answer.id)}
                disabled={!user}
              >
                ▼
              </button>
              {answer.is_accepted && (
                <div className="accepted-badge">✓</div>
              )}
              {user && user.id === question.author_id && !answer.is_accepted && (
                <button
                  className="accept-btn"
                  onClick={() => handleAcceptAnswer(answer.id)}
                  title="Прийняти відповідь"
                >
                  ✓
                </button>
              )}
            </div>

            <div className="answer-content">
              <div
                className="markdown-content"
                dangerouslySetInnerHTML={renderMarkdown(answer.body)}
              />

              <div className="answer-author">
                <div className="author-info">
                  <Link to={`/users/${answer.author_id}`} className="author-name">
                    {answer.author_name}
                  </Link>
                  <span className="author-date">{formatDate(answer.created_at)}</span>
                </div>
                {user && (user.id === answer.author_id || user.role === 'admin') && (
                  <div className="question-actions">
                    <button onClick={() => handleDeleteAnswer(answer.id)} className="btn btn-danger btn-sm">
                      ВИДАЛИТИ
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Схожі питання (AI) */}
      <AISimilarQuestions questionId={id} />

      {/* Форма відповіді */}
      {user ? (
        <div className="answer-form-section">
          <h2 className="section-title">ВАША ВІДПОВІДЬ</h2>

          {/* AI Assistant для генерації відповіді */}
          <AIAssistant
            questionId={id}
            onSuggestionReceived={(suggestion) => {
              setAnswerBody(suggestion);
            }}
          />

          <form onSubmit={handleSubmitAnswer}>
            <MarkdownEditor
              value={answerBody}
              onChange={setAnswerBody}
              showPreview={true}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !answerBody.trim()}
            >
              {submitting ? 'ДОДАВАННЯ...' : 'ДОДАТИ ВІДПОВІДЬ'}
            </button>
          </form>
        </div>
      ) : (
        <div className="login-prompt">
          <Link to="/login" className="btn btn-primary">
            УВІЙДІТЬ, ЩОБ ВІДПОВІСТИ
          </Link>
        </div>
      )}
    </div>
  );
}
