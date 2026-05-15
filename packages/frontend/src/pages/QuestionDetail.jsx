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
import { api, answers as answersApi, communityPosts } from '../services/api';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { AIAssistant } from '../components/AIAssistant';
import { AISimilarQuestions } from '../components/AISimilarQuestions';
import { AIQuestionSummary } from '../components/AIQuestionSummary';
import { AIAnswersSummary } from '../components/AIAnswersSummary';
import { AIRelatedPosts } from '../components/AIRelatedPosts';
import { LinkedReposPanel } from '../components/LinkedReposPanel';
import { VoteButtons } from '../components/VoteButtons';
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
  const [relatedCommunityPosts, setRelatedCommunityPosts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);

  const isAcceptedAnswer = (answer) => Boolean(Number(answer?.is_accepted));
  const isQuestionAuthor = user && question && Number(user.id) === Number(question.author_id);
  const canManageAccepted = user && question && (
    Number(user.id) === Number(question.author_id) || user.role === 'admin'
  );
  const hasAcceptedAnswer = Array.isArray(answers) && answers.some(isAcceptedAnswer);

  useEffect(() => {
    loadQuestion();
    loadAnswers();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    communityPosts
      .forQuestion(id, { limit: 8 })
      .then((r) => {
        const payload = r.data?.data || r.data;
        setRelatedCommunityPosts(payload?.posts || []);
      })
      .catch(() => setRelatedCommunityPosts([]));
  }, [id]);

  const loadQuestion = async () => {
    setLoading(true);
    try {
      mediator.emit(EventTypes.API_REQUEST, { endpoint: `/questions/${id}` }, 'QuestionDetail');

      const response = await api.get(`/questions/${id}`, {
        headers: { 'X-Record-View': '1' },
      });
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

  const emitVoteAction = (voteType, entityType, entityId) => {
    mediator.emit(EventTypes.USER_ACTION, {
      action: 'vote',
      type: voteType,
      entityType,
      entityId,
    }, 'QuestionDetail');
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
    if (!canManageAccepted) {
      return;
    }

    setAcceptingId(answerId);
    try {
      await answersApi.accept(answerId);
      await loadAnswers();

      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'success',
        message: 'Відповідь прийнято як правильну'
      }, 'QuestionDetail');
    } catch (error) {
      console.error('Помилка прийняття відповіді:', error);
      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'error',
        message: error.response?.data?.message || 'Не вдалося прийняти відповідь'
      }, 'QuestionDetail');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleUnacceptAnswer = async (answerId) => {
    if (!canManageAccepted) {
      return;
    }

    setAcceptingId(answerId);
    try {
      await answersApi.unaccept(answerId);
      await loadAnswers();

      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'success',
        message: 'Позначку правильної відповіді знято'
      }, 'QuestionDetail');
    } catch (error) {
      console.error('Помилка зняття позначки:', error);
      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'error',
        message: error.response?.data?.message || 'Не вдалося зняти позначку'
      }, 'QuestionDetail');
    } finally {
      setAcceptingId(null);
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
        <VoteButtons
          entityType="question"
          entityId={question.id}
          votes={question.votes}
          upvotes={question.upvotes}
          downvotes={question.downvotes}
          userVote={question.user_vote}
          onUpdate={() => loadQuestion()}
          onVoted={(voteType) => emitVoteAction(voteType, 'question', question.id)}
        />

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
        <AIAnswersSummary questionId={question.id} answerCount={answers.length} />
        <h2 className="section-title">
          {Array.isArray(answers) ? answers.length : 0} {Array.isArray(answers) && answers.length === 1 ? 'ВІДПОВІДЬ' : 'ВІДПОВІДЕЙ'}
        </h2>

        <div className="accept-answer-help" role="note">
          <strong>Як позначити правильну відповідь?</strong>
          <p>
            Якщо ви автор питання — натисніть «Прийняти відповідь» біля найкращої відповіді.
            Вона закріпиться зверху та отримає позначку.
          </p>
          {!user && (
            <p className="accept-answer-help-muted">
              Увійдіть у свій обліковий запис, щоб керувати відповідями на власних питаннях.
            </p>
          )}
          {user && !isQuestionAuthor && user.role !== 'admin' && (
            <p className="accept-answer-help-muted">
              Автор питання може позначити найкращу відповідь кнопкою «Прийняти відповідь».
            </p>
          )}
          {canManageAccepted && answers.length > 0 && !hasAcceptedAnswer && (
            <p className="accept-answer-help-cta">
              Оберіть найкращу відповідь нижче — натисніть «Прийняти відповідь».
            </p>
          )}
        </div>

        {canManageAccepted && answers.length > 0 && !hasAcceptedAnswer && (
          <div className="accept-answer-banner">
            Ви автор цього питання — оберіть найкращу відповідь кнопкою «Прийняти відповідь».
          </div>
        )}

        {Array.isArray(answers) && answers.length === 0 && (
          <div className="answers-empty">
            <p>Поки що немає відповідей.</p>
            {isQuestionAuthor && (
              <p className="accept-answer-help-muted">
                Коли з&apos;являться відповіді, ви зможете позначити найкращу кнопкою «Прийняти відповідь».
              </p>
            )}
            {!isQuestionAuthor && (
              <p className="accept-answer-help-muted">
                Автор питання зможе позначити правильну відповідь після появи відповідей.
              </p>
            )}
          </div>
        )}

        {Array.isArray(answers) && answers.map((answer) => (
          <div
            key={answer.id}
            className={`answer-card ${isAcceptedAnswer(answer) ? 'accepted' : ''}`}
          >
            <div className="vote-section">
              <VoteButtons
                entityType="answer"
                entityId={answer.id}
                votes={answer.votes}
                upvotes={answer.upvotes}
                downvotes={answer.downvotes}
                userVote={answer.user_vote}
                onUpdate={() => loadAnswers()}
                onVoted={(voteType) => emitVoteAction(voteType, 'answer', answer.id)}
              />
              {isAcceptedAnswer(answer) && (
                <div className="accepted-badge" title="Прийнята відповідь">✓</div>
              )}
            </div>

            <div className="answer-content">
              {isAcceptedAnswer(answer) && (
                <div className="accepted-answer-label">ПРИЙНЯТА ВІДПОВІДЬ</div>
              )}

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
                <div className="answer-actions-row">
                  {canManageAccepted && !isAcceptedAnswer(answer) && (
                    <button
                      type="button"
                      className="btn btn-accept-answer"
                      onClick={() => handleAcceptAnswer(answer.id)}
                      disabled={acceptingId === answer.id}
                    >
                      {acceptingId === answer.id ? 'ЗБЕРІГАЄМО...' : 'ПРИЙНЯТИ ВІДПОВІДЬ'}
                    </button>
                  )}
                  {canManageAccepted && isAcceptedAnswer(answer) && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleUnacceptAnswer(answer.id)}
                      disabled={acceptingId === answer.id}
                    >
                      {acceptingId === answer.id ? '...' : 'ЗНЯТИ ПОЗНАЧКУ'}
                    </button>
                  )}
                  {user && (Number(user.id) === Number(answer.author_id) || user.role === 'admin') && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAnswer(answer.id)}
                      className="btn btn-danger btn-sm"
                    >
                      ВИДАЛИТИ
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {relatedCommunityPosts.length > 0 && (
        <div className="question-detail-card" style={{ marginTop: 'var(--space-4)' }}>
          <h2 className="section-title">У СПІЛЬНОТАХ ЗА СХОЖИМИ ТЕГАМИ</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {relatedCommunityPosts.map((p) => (
              <div key={p.id} style={{ border: '2px solid #000', padding: 12, background: '#fff' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
                  {p.community_name && (
                    <Link to={`/communities/${p.community_slug}`} className="tag">{p.community_name}</Link>
                  )}
                </div>
                <Link to={`/community-posts/${p.id}`} className="question-title">{p.title}</Link>
                <p className="question-excerpt" style={{ marginTop: 8 }}>
                  {(p.body || '').slice(0, 160)}{p.body && p.body.length > 160 ? '…' : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Пов'язані GitHub репозиторії */}
      <div style={{ marginTop: 'var(--space-4)' }}>
        <LinkedReposPanel targetType="question" targetId={id} />
      </div>

      <AIRelatedPosts questionId={id} />

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
