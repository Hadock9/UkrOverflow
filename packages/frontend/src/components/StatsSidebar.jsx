/**
 * Stats Sidebar Component
 * Відображає статистику платформи на головній сторінці
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { stats } from '../services/api';
import './StatsSidebar.css';

export function StatsSidebar() {
  const [overview, setOverview] = useState(null);
  const [topTags, setTopTags] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [overviewRes, tagsRes, usersRes] = await Promise.allSettled([
        stats.overview(),
        stats.topTags(10),
        stats.topUsers(5),
      ]);

      if (overviewRes.status === 'fulfilled') {
        setOverview(overviewRes.value.data.data);
      }
      if (tagsRes.status === 'fulfilled') {
        setTopTags(tagsRes.value.data.data.tags || []);
      }
      if (usersRes.status === 'fulfilled') {
        setTopUsers(usersRes.value.data.data.users || []);
      } else {
        console.error('Error loading top users:', usersRes.reason);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <aside className="stats-sidebar">
        <div className="loading-box">⏳ ЗАВАНТАЖЕННЯ...</div>
      </aside>
    );
  }

  return (
    <aside className="stats-sidebar">
      {/* Загальна статистика */}
      {overview && (
        <div className="stats-box">
          <h3 className="stats-title">📊 СТАТИСТИКА</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{overview.total.total_questions}</div>
              <div className="stat-label">ПИТАНЬ</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{overview.total.total_answers}</div>
              <div className="stat-label">ВІДПОВІДЕЙ</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{overview.total.total_users}</div>
              <div className="stat-label">КОРИСТУВАЧІВ</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{overview.today.questions_today}</div>
              <div className="stat-label">СЬОГОДНІ</div>
            </div>
          </div>
        </div>
      )}

      {/* Топ теги */}
      {topTags.length > 0 && (
        <div className="stats-box">
          <h3 className="stats-title">🏷️ ПОПУЛЯРНІ ТЕГИ</h3>
          <div className="tags-list">
            {topTags.slice(0, 10).map((tag, index) => (
              <Link
                key={index}
                to={`/tags/${tag.tag}`}
                className="tag-item"
              >
                <span className="tag-name">{tag.tag}</span>
                <span className="tag-count">{tag.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Топ користувачі */}
      {topUsers.length > 0 && (
        <div className="stats-box">
          <h3 className="stats-title">👑 ТОП КОРИСТУВАЧІВ</h3>
          <div className="users-list">
            {topUsers.map((user, index) => (
              <Link
                key={user.id}
                to={`/users/${user.id}`}
                className="user-item"
              >
                <span className="user-rank">#{index + 1}</span>
                <div className="user-info">
                  <div className="user-name">{user.username}</div>
                  <div className="user-rep">⭐ {user.reputation}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
