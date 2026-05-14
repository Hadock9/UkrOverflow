/**
 * Сторінка тегів
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import '../styles/brutalism.css';

export function Tags() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    setLoading(true);
    try {
      const response = await api.get('/questions/tags/all');
      const tagsData = response.data.data?.tags || response.data.tags || [];
      setTags(tagsData);
    } catch (error) {
      console.error('Помилка завантаження тегів:', error);
      setTags([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">ТЕГИ</h1>
          <p className="page-subtitle">
            Всього тегів: {tags.length}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="loading">ЗАВАНТАЖЕННЯ...</div>
      ) : tags.length === 0 ? (
        <div className="empty-state">
          <p>ТЕГІВ ПОКИ НЕМАЄ</p>
        </div>
      ) : (
        <div className="grid grid-3" style={{ marginTop: 'var(--space-4)' }}>
          {tags.map((tag, index) => (
            <Link
              key={index}
              to={`/tags/${tag.name}`}
              className="card card-hover"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="tag" style={{
                fontSize: '1.25rem',
                padding: 'var(--space-2) var(--space-3)',
                marginBottom: 'var(--space-2)'
              }}>
                {tag.name}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.875rem',
                color: 'var(--color-gray-700)'
              }}>
                {tag.count} {tag.count === 1 ? 'питання' : 'питань'}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
