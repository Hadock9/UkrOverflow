/**
 * Сторінка профілю користувача (особистий кабінет)
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMediator } from '../contexts/MediatorContext';
import { EventTypes } from '../../../mediator/src/index';
import { api, communityPosts } from '../services/api';
import { GitHubProfileCard } from '../components/GitHubProfileCard';
import '../styles/brutalism.css';

// Конфіг типів контенту: ендпоінти, ключі у response.data, маршрути detail/edit, лейбли.
// Лейбл вкладки в множині, ім'я в однині використовується в empty-state.
const CONTENT_TYPES = [
  {
    key: 'articles',
    endpoint: '/articles',
    listKey: 'articles',
    deleteEndpoint: '/articles',
    tabLabel: 'СТАТТІ',
    singular: 'статтю',
    detail: (id) => `/articles/${id}`,
    edit: (id) => `/articles/${id}/edit`,
    hasEdit: true,
  },
  {
    key: 'guides',
    endpoint: '/guides',
    listKey: 'guides',
    deleteEndpoint: '/guides',
    tabLabel: 'ГАЙДИ',
    singular: 'гайд',
    detail: (id) => `/guides/${id}`,
    edit: (id) => `/guides/${id}/edit`,
    hasEdit: true,
  },
  {
    key: 'snippets',
    endpoint: '/snippets',
    listKey: 'snippets',
    deleteEndpoint: '/snippets',
    tabLabel: 'СНІПЕТИ',
    singular: 'сніпет',
    detail: (id) => `/snippets/${id}`,
    edit: (id) => `/snippets/${id}/edit`,
    hasEdit: true,
  },
  {
    key: 'roadmaps',
    endpoint: '/roadmaps',
    listKey: 'roadmaps',
    deleteEndpoint: '/roadmaps',
    tabLabel: 'МАРШРУТИ',
    singular: 'маршрут',
    detail: (id) => `/roadmaps/${id}`,
    edit: null,
    hasEdit: false,
  },
  {
    key: 'bestPractices',
    endpoint: '/best-practices',
    listKey: 'bestPractices',
    deleteEndpoint: '/best-practices',
    tabLabel: 'НАЙКРАЩІ ПРАКТИКИ',
    singular: 'практику',
    detail: (id) => `/best-practices/${id}`,
    edit: null,
    hasEdit: false,
  },
  {
    key: 'faqs',
    endpoint: '/faqs',
    listKey: 'faqs',
    deleteEndpoint: '/faqs',
    tabLabel: 'ЧАП',
    singular: 'ЧаП',
    detail: (id) => `/faqs/${id}`,
    edit: null,
    hasEdit: false,
  },
];

const COMMUNITY_POST_TYPE_LABELS = {
  discussion: 'Обговорення',
  pet_project: 'Pet-проєкт',
  code_review: 'Code review',
  mentor_request: 'Запит ментора',
  roadmap_request: 'Маршрут / навчання',
  team_search: 'Пошук команди',
  event: 'Подія',
  announcement: 'Оголошення',
};

// Витягує масив сутностей з відповіді API, незалежно від форми (.data.data.X / .data.X / .data)
function extractList(response, key) {
  const root = response?.data;
  if (!root) return [];
  const candidates = [
    root?.data?.[key],
    root?.[key],
    Array.isArray(root?.data) ? root.data : null,
    Array.isArray(root) ? root : null,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

export function Profile() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const mediator = useMediator();

  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  // Окремий стейт для кожного типу knowledge hub
  const [articles, setArticles] = useState([]);
  const [guides, setGuides] = useState([]);
  const [snippets, setSnippets] = useState([]);
  const [roadmaps, setRoadmaps] = useState([]);
  const [bestPractices, setBestPractices] = useState([]);
  const [faqs, setFaqs] = useState([]);
  /** Пости у спільнотах (окрема таблиця /api; не входять у /api/content) */
  const [userCommunityPosts, setUserCommunityPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('questions');

  const userId = id || currentUser?.id;
  const isOwnProfile = currentUser && currentUser.id === parseInt(userId);

  // Мапа сетерів за ключем — дозволяє в одному циклі розкласти результати Promise.all
  const setters = {
    articles: setArticles,
    guides: setGuides,
    snippets: setSnippets,
    roadmaps: setRoadmaps,
    bestPractices: setBestPractices,
    faqs: setFaqs,
  };

  useEffect(() => {
    if (!userId) {
      navigate('/login');
      return;
    }

    loadProfile();
    loadAllContent();
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
        error: error.message,
      }, 'Profile');
    } finally {
      setLoading(false);
    }
  };

  // Паралельно: увесь хаб одним запитом /api/content + відповіді + пости спільнот
  const loadAllContent = async () => {
    setContentLoading(true);
    const aid = parseInt(userId, 10);
    const params = { authorId: aid, limit: 100 };

    const tasks = [
      api
        .get('/content', { params: { authorId: aid, contentType: 'all', limit: 300, page: 1 } })
        .then((r) => {
          const items = r.data?.data?.items || [];
          setQuestions(items.filter((i) => i.type === 'question'));
          setArticles(items.filter((i) => i.type === 'article'));
          setGuides(items.filter((i) => i.type === 'guide'));
          setSnippets(items.filter((i) => i.type === 'snippet'));
          setRoadmaps(items.filter((i) => i.type === 'roadmap'));
          setBestPractices(items.filter((i) => i.type === 'best_practice'));
          setFaqs(items.filter((i) => i.type === 'faq'));
        })
        .catch((e) => console.error('Помилка завантаження контенту хабу:', e)),
      api.get('/answers', { params })
        .then((r) => setAnswers(extractList(r, 'answers')))
        .catch((e) => console.error('Помилка завантаження відповідей:', e)),
      communityPosts
        .list({ authorId: aid, limit: 100, page: 1 })
        .then((r) => setUserCommunityPosts(r.data?.data?.posts || []))
        .catch((e) => console.error('Помилка завантаження постів спільнот:', e)),
    ];

    await Promise.all(tasks);
    setContentLoading(false);
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!confirm('Ви впевнені, що хочете видалити це питання?')) return;
    try {
      await api.delete(`/questions/${questionId}`);
      const r = await api.get('/questions', { params: { authorId: userId, limit: 100 } });
      setQuestions(extractList(r, 'questions'));
      mediator.emit(EventTypes.NOTIFICATION, { type: 'success', message: 'Питання видалено' }, 'Profile');
    } catch (error) {
      console.error('Помилка видалення питання:', error);
      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'error',
        message: error.response?.data?.message || 'Помилка видалення питання',
      }, 'Profile');
    }
  };

  const handleDeleteCommunityPost = async (postId) => {
    if (!confirm('Ви впевнені, що хочете видалити цей пост у спільноті?')) return;
    try {
      await communityPosts.delete(postId);
      const r = await communityPosts.list({ authorId: parseInt(userId, 10), limit: 100, page: 1 });
      setUserCommunityPosts(r.data?.data?.posts || []);
      mediator.emit(EventTypes.NOTIFICATION, { type: 'success', message: 'Пост видалено' }, 'Profile');
    } catch (error) {
      console.error('Помилка видалення посту спільноти:', error);
      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'error',
        message: error.response?.data?.message || 'Помилка видалення посту',
      }, 'Profile');
    }
  };

  const handleDeleteAnswer = async (answerId) => {
    if (!confirm('Ви впевнені, що хочете видалити цю відповідь?')) return;
    try {
      await api.delete(`/answers/${answerId}`);
      const r = await api.get('/answers', { params: { authorId: userId, limit: 100 } });
      setAnswers(extractList(r, 'answers'));
      mediator.emit(EventTypes.NOTIFICATION, { type: 'success', message: 'Відповідь видалено' }, 'Profile');
    } catch (error) {
      console.error('Помилка видалення відповіді:', error);
      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'error',
        message: error.response?.data?.message || 'Помилка видалення відповіді',
      }, 'Profile');
    }
  };

  // Уніфіковане видалення для будь-якого hub-типу
  const handleDeleteHubItem = async (type, itemId) => {
    if (!confirm(`Ви впевнені, що хочете видалити цей елемент?`)) return;
    try {
      await api.delete(`${type.deleteEndpoint}/${itemId}`);
      const r = await api.get(type.endpoint, { params: { authorId: userId, limit: 100 } });
      setters[type.key](extractList(r, type.listKey));
      mediator.emit(EventTypes.NOTIFICATION, { type: 'success', message: 'Елемент видалено' }, 'Profile');
    } catch (error) {
      console.error(`Помилка видалення ${type.key}:`, error);
      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'error',
        message: error.response?.data?.message || 'Помилка видалення',
      }, 'Profile');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Спільна карточка для будь-якого hub-елементу: title -> detail, excerpt, tags, дата, кнопки
  const renderItemCard = (item, type) => {
    const excerptSource = item.excerpt || item.body || item.description || item.content || '';
    const excerpt = typeof excerptSource === 'string'
      ? excerptSource.substring(0, 200) + (excerptSource.length > 200 ? '...' : '')
      : '';
    const tags = Array.isArray(item.tags) ? item.tags : [];

    return (
      <div key={`${type.key}-${item.id}`} className="question-card">
        <div className="question-content" style={{ flex: 1 }}>
          <Link to={type.detail(item.id)} className="question-title">
            {item.title || `${type.singular} #${item.id}`}
          </Link>

          {excerpt && (
            <div className="question-excerpt">
              {excerpt}
            </div>
          )}

          {tags.length > 0 && (
            <div className="question-tags">
              {tags.map((tag, index) => (
                <Link key={index} to={`/tags/${tag}`} className="tag">
                  {tag}
                </Link>
              ))}
            </div>
          )}

          <div className="question-meta">
            <span className="date">Створено {formatDate(item.created_at)}</span>
            {isOwnProfile && (
              <div className="question-actions" style={{ marginLeft: 'auto' }}>
                {type.hasEdit && (
                  <Link to={type.edit(item.id)} className="btn btn-secondary btn-sm">
                    РЕДАГУВАТИ
                  </Link>
                )}
                <button
                  onClick={() => handleDeleteHubItem(type, item.id)}
                  className="btn btn-danger btn-sm"
                >
                  ВИДАЛИТИ
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
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

  // Перелік усіх вкладок з потрібними даними/лейблами/empty-станами
  const tabs = [
    { id: 'questions', label: 'ПИТАННЯ', count: questions.length },
    { id: 'answers', label: 'ВІДПОВІДІ', count: answers.length },
    { id: 'community_posts', label: 'СПІЛЬНОТА', count: userCommunityPosts.length },
    ...CONTENT_TYPES.map((t) => {
      const list =
        t.key === 'articles' ? articles :
          t.key === 'guides' ? guides :
            t.key === 'snippets' ? snippets :
              t.key === 'roadmaps' ? roadmaps :
                t.key === 'bestPractices' ? bestPractices :
                  faqs;
      return { id: t.key, label: t.tabLabel, count: list.length, type: t, list };
    }),
  ];

  return (
    <div className="container">
      {/* Заголовок профілю */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {user.avatar_url && (
            <img
              src={user.avatar_url}
              alt={user.username}
              style={{ width: 72, height: 72, border: '3px solid #000' }}
            />
          )}
          <div>
            <h1 className="page-title">{user.username}</h1>
            <p className="page-subtitle">
              Користувач з {formatDate(user.created_at)}
              {user.github_login ? ` · @${user.github_login} (GitHub)` : ''}
            </p>
          </div>
        </div>
      </div>

      <GitHubProfileCard
        userId={userId}
        isOwn={isOwnProfile}
        token={typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null}
      />

      {/* Статистика */}
      {(() => {
        const totalPosts =
          questions.length +
          userCommunityPosts.length +
          articles.length +
          guides.length +
          snippets.length +
          roadmaps.length +
          bestPractices.length +
          faqs.length;
        const breakdown = `Питання: ${questions.length} · Спільнота: ${userCommunityPosts.length} · Статті: ${articles.length} · Гайди: ${guides.length} · Сніпети: ${snippets.length} · Маршрути: ${roadmaps.length} · Найкращі практики: ${bestPractices.length} · ЧаП: ${faqs.length}`;
        return (
          <div className="grid grid-4" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card">
              <div className="stat">
                <div className="stat-value" style={{ color: 'var(--color-success)' }}>
                  {user.reputation || 0}
                </div>
                <div className="stat-label">РЕПУТАЦІЯ</div>
              </div>
            </div>
            <div className="card" title={breakdown}>
              <div className="stat">
                <div className="stat-value">{totalPosts}</div>
                <div className="stat-label">ДОПИСІВ</div>
              </div>
            </div>
            <div className="card">
              <div className="stat">
                <div className="stat-value">{answers.length || user.answers_count || 0}</div>
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
        );
      })()}

      {isOwnProfile && import.meta.env.DEV && !contentLoading &&
        questions.length === 0 &&
        answers.length === 0 &&
        userCommunityPosts.length === 0 &&
        articles.length === 0 &&
        guides.length === 0 &&
        snippets.length === 0 &&
        roadmaps.length === 0 &&
        bestPractices.length === 0 &&
        faqs.length === 0 && (
        <div
          className="card"
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-3)',
            fontSize: '0.9rem',
            border: '2px dashed var(--border-color)',
          }}
        >
          <strong>Локально:</strong> після загального <code>npm run seed</code> питання та статті розподілені між десятьма
          тестовими користувачами, а не під одним акаунтом. Зареєстрований профіль може лишатися порожнім.
          Щоб згенерувати питання на різні теми та хаб-контент саме для <strong>цього</strong> користувача, у
          {' '}<code>packages/backend</code> виконайте:
          <pre
            style={{
              marginTop: 'var(--space-2)',
              marginBottom: 0,
              padding: 'var(--space-2)',
              overflow: 'auto',
              background: 'var(--color-gray-100)',
              border: '2px solid var(--border-color)',
            }}
          >
            {`npm run seed:user -- --user=${userId}`}
          </pre>
        </div>
      )}

      {/* Вкладки */}
      <div className="filters" style={{ flexWrap: 'wrap' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`filter-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Вміст вкладок */}
      {activeTab === 'questions' && (
        <div className="questions-list">
          {contentLoading ? (
            <div className="loading">ЗАВАНТАЖЕННЯ...</div>
          ) : questions.length === 0 ? (
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
          {contentLoading ? (
            <div className="loading">ЗАВАНТАЖЕННЯ...</div>
          ) : answers.length === 0 ? (
            <div className="empty-state">
              <p>{isOwnProfile ? 'Ви ще не дали жодної відповіді' : 'Користувач не дав жодної відповіді'}</p>
            </div>
          ) : (
            answers.map((answer) => (
              <div key={answer.id} className="question-card">
                <div className="question-stats">
                  <div className="stat">
                    <div className="stat-value">
                      {typeof answer.votes === 'number'
                        ? answer.votes
                        : (Number(answer.upvotes) || 0) - (Number(answer.downvotes) || 0)}
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
                    {(answer.body || '').substring(0, 200)}{(answer.body || '').length > 200 ? '...' : ''}
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

      {activeTab === 'community_posts' && (
        <div className="questions-list">
          {contentLoading ? (
            <div className="loading">ЗАВАНТАЖЕННЯ...</div>
          ) : userCommunityPosts.length === 0 ? (
            <div className="empty-state">
              <p>
                {isOwnProfile
                  ? 'Ви ще не створили жодного посту у спільнотах'
                  : 'Користувач не створив жодного посту у спільнотах'}
              </p>
            </div>
          ) : (
            userCommunityPosts.map((post) => {
              const bodyPreview = typeof post.body === 'string'
                ? post.body.substring(0, 220) + (post.body.length > 220 ? '...' : '')
                : '';
              const typeLabel = COMMUNITY_POST_TYPE_LABELS[post.type] || post.type || '';
              return (
                <div key={post.id} className="question-card">
                  <div className="question-stats">
                    <div className="stat">
                      <div className="stat-value">{post.votes ?? 0}</div>
                      <div className="stat-label">ГОЛОСІВ</div>
                    </div>
                    <div className="stat">
                      <div className="stat-value">{post.comment_count ?? 0}</div>
                      <div className="stat-label">КОМЕНТАРІВ</div>
                    </div>
                    <div className="stat">
                      <div className="stat-value">{post.views ?? 0}</div>
                      <div className="stat-label">ПЕРЕГЛЯДІВ</div>
                    </div>
                  </div>
                  <div className="question-content">
                    <Link to={`/community-posts/${post.id}`} className="question-title">
                      {post.title}
                    </Link>
                    {post.community_slug && (
                      <div style={{ marginTop: 'var(--space-2)', fontSize: '0.9rem' }}>
                        <span className="badge badge-secondary">{typeLabel}</span>
                        {' · '}
                        <Link to={`/communities/${post.community_slug}`}>
                          {post.community_name || post.community_slug}
                        </Link>
                      </div>
                    )}
                    {!post.community_slug && typeLabel && (
                      <div style={{ marginTop: 'var(--space-2)', fontSize: '0.9rem' }}>
                        <span className="badge badge-secondary">{typeLabel}</span>
                      </div>
                    )}
                    {bodyPreview && (
                      <div className="question-excerpt">{bodyPreview}</div>
                    )}
                    <div className="question-meta">
                      <span className="date">Створено {formatDate(post.created_at)}</span>
                      {isOwnProfile && (
                        <div className="question-actions" style={{ marginLeft: 'auto' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteCommunityPost(post.id)}
                            className="btn btn-danger btn-sm"
                          >
                            ВИДАЛИТИ
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Уніфіковані вкладки для всіх knowledge-hub типів */}
      {CONTENT_TYPES.map((type) => {
        if (activeTab !== type.key) return null;
        const list =
          type.key === 'articles' ? articles :
            type.key === 'guides' ? guides :
              type.key === 'snippets' ? snippets :
                type.key === 'roadmaps' ? roadmaps :
                  type.key === 'bestPractices' ? bestPractices :
                    faqs;

        return (
          <div key={type.key} className="questions-list">
            {contentLoading ? (
              <div className="loading">ЗАВАНТАЖЕННЯ...</div>
            ) : list.length === 0 ? (
              <div className="empty-state">
                <p>
                  {isOwnProfile
                    ? `Ви ще не створили жодного елементу: ${type.tabLabel.toLowerCase()}`
                    : `Користувач не створив жодного елементу: ${type.tabLabel.toLowerCase()}`}
                </p>
              </div>
            ) : (
              list.map((item) => renderItemCard(item, type))
            )}
          </div>
        );
      })}
    </div>
  );
}
