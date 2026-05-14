/**
 * Сторінка перегляду статті knowledge hub.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { LinkedReposPanel } from '../components/LinkedReposPanel';
import '../styles/brutalism.css';

export function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArticle();
  }, [id]);

  const loadArticle = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/articles/${id}`, {
        headers: { 'X-Record-View': '1' },
      });
      const articleData = response.data.data?.article || response.data.article || response.data;
      setArticle(articleData);
    } catch (error) {
      console.error('Помилка завантаження статті:', error);
      setArticle(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Ви впевнені, що хочете видалити цю статтю?')) return;

    try {
      await api.delete(`/articles/${id}`);
      navigate('/');
    } catch (error) {
      console.error('Помилка видалення статті:', error);
      alert(error.response?.data?.message || 'Помилка видалення статті');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  if (!article) {
    return <div className="container"><div className="error">СТАТТЮ НЕ ЗНАЙДЕНО</div></div>;
  }

  const canManage = user && (user.id === article.author_id || user.role === 'admin');

  return (
    <div className="container">
      <div className="question-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ marginBottom: 'var(--space-2)' }}>
              <span className="tag">Стаття</span>
            </div>
            <h1 className="question-detail-title">{article.title}</h1>
            <div className="question-info">
              <span>Опубліковано: {formatDate(article.created_at)}</span>
              <span>•</span>
              <span>Переглядів: {article.views}</span>
            </div>
          </div>

          {canManage && (
            <div className="question-actions" style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Link to={`/articles/${article.id}/edit`} className="btn btn-secondary btn-sm">
                РЕДАГУВАТИ
              </Link>
              <button type="button" onClick={handleDelete} className="btn btn-danger btn-sm">
                ВИДАЛИТИ
              </button>
            </div>
          )}
        </div>
      </div>

      {article.excerpt && (
        <div className="question-detail-card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="question-content">
            <p style={{ margin: 0, fontSize: '1.125rem' }}>{article.excerpt}</p>
          </div>
        </div>
      )}

      <div className="question-detail-card">
        <div className="question-content" style={{ width: '100%' }}>
          <div className="question-tags" style={{ marginBottom: 'var(--space-3)' }}>
            {Array.isArray(article.tags) && article.tags.map((tag, index) => (
              <Link key={index} to={`/tags/${tag}`} className="tag">
                {tag}
              </Link>
            ))}
          </div>

          <div className="markdown-content" dangerouslySetInnerHTML={renderMarkdown(article.body)} />

          <div className="question-meta" style={{ marginTop: 'var(--space-4)' }}>
            <Link to={`/users/${article.author_id}`} className="author">
              {article.author_name}
            </Link>
            <span className="separator">•</span>
            <span className="date">knowledge hub / article</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-4)' }}>
        <LinkedReposPanel targetType="article" targetId={article.id} />
      </div>
    </div>
  );
}

export default ArticleDetail;
