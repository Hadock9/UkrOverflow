/**
 * Головна сторінка — вітальний екран і швидкий доступ до розділів платформи.
 * Стрічка контенту: /hub
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMediator } from '../contexts/MediatorContext';
import { EventTypes } from '../../../mediator/src/index';
import { api, news as newsApi } from '../services/api';
import { StatsSidebar } from '../components/StatsSidebar';
import { getContentDetailPath, getContentTypeMeta } from '../constants/contentTypes';
import '../styles/brutalism.css';

const FEATURES = [
  {
    to: '/hub',
    title: 'ХАБ ЗНАНЬ',
    text: 'Питання, статті, гайди, сніпети, маршрути та ЧаП в одному потоці.',
    accent: '#f5d142',
  },
  {
    to: '/news',
    title: 'СТРІЧКА НОВИН',
    text: 'Огляди українського IT, тренди та оновлення платформи.',
    accent: '#ff9bd3',
  },
  {
    to: '/communities',
    title: "КОМ'ЮНІТІ",
    text: 'Міста, університети, онлайн-групи — пости, обговорення, pet-проєкти.',
    accent: '#b8f4e8',
  },
  {
    to: '/mentors',
    title: 'МЕНТОРИ',
    text: 'Профілі менторів, стек, теми та контакт для сесій.',
    accent: '#c9b8ff',
  },
  {
    to: '/search',
    title: 'ПОШУК',
    text: 'Глобальний пошук по всьому контенту платформи.',
    accent: '#9bd3ff',
  },
  {
    to: '/tags',
    title: 'ТЕГИ',
    text: 'Популярні теми та фільтрація матеріалів за тегами.',
    accent: '#ffb3c7',
  },
  {
    to: '/devs',
    title: 'РОЗРОБНИКИ',
    text: 'Каталог розробників, рейтинг та профілі учасників.',
    accent: '#9ee6a0',
  },
];

export function MainPage() {
  const { user, isAuthenticated } = useAuth();
  const mediator = useMediator();
  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [latestNews, setLatestNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
    mediator.emit(EventTypes.PAGE_VIEW, { page: 'main' }, 'MainPage');
  }, [mediator]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRecentLoading(true);
      try {
        const res = await api.get('/content', {
          params: { sortBy: 'created_at', page: 1, limit: 6, contentType: 'all' },
        });
        if (!cancelled) {
          setRecent(res.data?.data?.items || []);
        }
      } catch (e) {
        console.error('Не вдалося завантажити превʼю контенту:', e);
        if (!cancelled) setRecent([]);
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setNewsLoading(true);
      try {
        const res = await newsApi.list({ page: 1, limit: 3 });
        if (!cancelled) setLatestNews(res.data?.data?.news || []);
      } catch {
        if (!cancelled) setLatestNews([]);
      } finally {
        if (!cancelled) setNewsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="container main-page">
      <div className="main-page-layout">
        <div className="main-page-primary">
          <section className="main-hero">
            <p className="main-hero-kicker">DEVFLOW</p>
            <h1 className="main-hero-title">
              {isAuthenticated && user?.username
                ? `ВІТАЄМО, ${user.username.toUpperCase()}`
                : 'СПІЛЬНОТА РОЗРОБНИКІВ УКРАЇНИ'}
            </h1>
            <p className="main-hero-lead">
              Knowledge hub для питань, статей, спільнот і менторства. Діліться досвідом,
              знаходьте відповіді та ростіть разом із командою однодумців.
            </p>
            <div className="main-hero-actions">
              <Link to="/hub" className="btn btn-primary">
                ВІДКРИТИ ХАБ
              </Link>
              <Link to="/news" className="btn">
                НОВИНИ
              </Link>
              <Link to="/communities" className="btn">
                СПІЛЬНОТИ
              </Link>
              <Link to="/mentors" className="btn">
                МЕНТОРИ
              </Link>
              {!isAuthenticated && (
                <>
                  <Link to="/login" className="btn btn-secondary">
                    УВІЙТИ
                  </Link>
                  <Link to="/register" className="btn btn-secondary">
                    РЕЄСТРАЦІЯ
                  </Link>
                </>
              )}
              {isAuthenticated && (
                <Link to="/profile" className="btn btn-secondary">
                  МІЙ ПРОФІЛЬ
                </Link>
              )}
            </div>
          </section>

          <section className="main-feature-grid" aria-label="Розділи платформи">
            {FEATURES.map((f) => (
              <Link
                key={f.to}
                to={f.to}
                className="main-feature-card"
                style={{ background: f.accent }}
              >
                <h2 className="main-feature-card-title">{f.title}</h2>
                <p className="main-feature-card-text">{f.text}</p>
              </Link>
            ))}
          </section>

          <section className="main-recent main-news-preview">
            <div className="page-header page-header-split" style={{ marginBottom: 16 }}>
              <div>
                <h2 className="page-title" style={{ fontSize: '1.35rem' }}>
                  СТРІЧКА НОВИН
                </h2>
                <p className="page-subtitle">Останні огляди українського IT</p>
              </div>
              <Link to="/news" className="btn">
                УСІ НОВИНИ →
              </Link>
            </div>
            {newsLoading ? (
              <div className="loading">ЗАВАНТАЖЕННЯ...</div>
            ) : latestNews.length > 0 ? (
              <ul className="main-recent-list">
                {latestNews.map((n) => (
                  <li key={n.id} className="main-recent-item">
                    <span className="main-recent-type">Новина</span>
                    <Link
                      to={n.slug ? `/news/${n.slug}` : `/news/${n.id}`}
                      className="main-recent-link"
                    >
                      {n.title}
                    </Link>
                    {n.summary && (
                      <p className="main-recent-excerpt">{n.summary.slice(0, 120)}…</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="main-recent">
            <div className="page-header page-header-split" style={{ marginBottom: 16 }}>
              <div>
                <h2 className="page-title" style={{ fontSize: '1.35rem' }}>
                  СВІЖЕ В ХАБІ
                </h2>
                <p className="page-subtitle">Останні публікації з усіх типів контенту</p>
              </div>
              <Link to="/hub" className="btn">
                УСЯ СТРІЧКА →
              </Link>
            </div>

            {recentLoading ? (
              <div className="loading">ЗАВАНТАЖЕННЯ...</div>
            ) : recent.length === 0 ? (
              <div className="empty-state">
                <p>ПОКИ НЕМАЄ ПУБЛІКАЦІЙ</p>
                <Link to="/questions/new" className="btn btn-primary">
                  СТВОРИТИ ПЕРШЕ ПИТАННЯ
                </Link>
              </div>
            ) : (
              <ul className="main-recent-list">
                {recent.map((item) => {
                  const meta = getContentTypeMeta(item.type);
                  const excerpt = (item.excerpt || item.body || '').toString().slice(0, 120);
                  return (
                    <li key={`${item.type}-${item.id}`} className="main-recent-item">
                      <span className="main-recent-type">{meta?.shortLabel || item.type}</span>
                      <Link to={getContentDetailPath(item.type, item.id)} className="main-recent-link">
                        {item.title}
                      </Link>
                      {excerpt && <p className="main-recent-excerpt">{excerpt}…</p>}
                      <span className="main-recent-meta">
                        {item.author_name} · {item.votes ?? 0} голосів
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="main-page-aside">
          <StatsSidebar />
        </aside>
      </div>
    </div>
  );
}

export default MainPage;
