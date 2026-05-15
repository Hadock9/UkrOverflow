/**
 * Бічна панель новин у стилі DOU: тренди, теги, зарплатний блок.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { news } from '../services/api';
import { NewsPollWidget } from './NewsPollWidget';

const CATEGORY_LABELS = {
  salary: 'Зарплати',
  career: 'Карʼєра',
  tech: 'Технології',
  community: 'Спільнота',
  events: 'Події',
  ai: 'ШІ / ML',
};

function newsPath(item) {
  return item.slug ? `/news/${item.slug}` : `/news/${item.id}`;
}

export function NewsSidebar() {
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await news.digest();
        if (!cancelled) setDigest(res.data?.data || null);
      } catch {
        if (!cancelled) setDigest(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <aside className="news-sidebar">
        <div className="news-sidebar-box loading">ЗАВАНТАЖЕННЯ…</div>
      </aside>
    );
  }

  if (!digest) return null;

  const { trendingWeek, topTags, salarySpotlight, marketPulse, totalPosts, categoryStats } = digest;

  return (
    <aside className="news-sidebar" aria-label="Дайджест новин">
      <NewsPollWidget />

      <div className="news-sidebar-box news-sidebar-box--pulse">
        <h3 className="news-sidebar-title">ПУЛЬС IT-РИНКУ</h3>
        <p className="news-sidebar-muted">{marketPulse?.hint}</p>
        <ul className="news-sidebar-stats">
          <li><strong>{totalPosts}</strong> матеріалів у стрічці</li>
          <li><strong>{marketPulse?.salarySharePercent ?? 0}%</strong> про зарплати</li>
          <li><strong>{marketPulse?.techSharePercent ?? 0}%</strong> про технології</li>
        </ul>
        {categoryStats?.length > 0 && (
          <div className="news-sidebar-bars">
            {categoryStats.slice(0, 4).map((c) => (
              <div key={c.category} className="news-sidebar-bar-row">
                <span>{CATEGORY_LABELS[c.category] || c.category}</span>
                <span>{c.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {trendingWeek?.length > 0 && (
        <div className="news-sidebar-box">
          <h3 className="news-sidebar-title">🔥 ПОПУЛЯРНЕ ЗА ТИЖДЕНЬ</h3>
          <ul className="news-sidebar-list">
            {trendingWeek.map((item) => (
              <li key={item.id}>
                <Link to={newsPath(item)} className="news-sidebar-link">
                  {item.title}
                </Link>
                <span className="news-sidebar-meta">{item.views ?? 0} переглядів</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {salarySpotlight?.length > 0 && (
        <div className="news-sidebar-box news-sidebar-box--salary">
          <h3 className="news-sidebar-title">💰 ЯК НА DOU: ЗАРПЛАТИ</h3>
          <ul className="news-sidebar-list">
            {salarySpotlight.map((item) => (
              <li key={item.id}>
                <Link to={newsPath(item)} className="news-sidebar-link">
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {topTags?.length > 0 && (
        <div className="news-sidebar-box">
          <h3 className="news-sidebar-title">🏷️ ТОП ТЕГІ</h3>
          <div className="tags">
            {topTags.map(({ tag, count }) => (
              <Link key={tag} to={`/news?tag=${encodeURIComponent(tag)}`} className="tag">
                {tag} ({count})
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export default NewsSidebar;
