/**
 * Сторінка перегляду snippet.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useAuth } from '../contexts/AuthContext';
import { snippets } from '../services/api';
import '../styles/brutalism.css';

export function SnippetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [snippet, setSnippet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSnippet();
  }, [id]);

  const loadSnippet = async () => {
    setLoading(true);
    try {
      const response = await snippets.get(id, {
        headers: { 'X-Record-View': '1' },
      });
      const snippetData = response.data.data?.snippet || response.data.snippet || response.data;
      setSnippet(snippetData);
    } catch (error) {
      console.error('Помилка завантаження snippet:', error);
      setSnippet(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Ви впевнені, що хочете видалити цей snippet?')) return;
    try {
      await snippets.delete(id);
      navigate('/');
    } catch (error) {
      console.error('Помилка видалення snippet:', error);
      alert(error.response?.data?.message || 'Помилка видалення snippet');
    }
  };

  const renderMarkdown = (text) => {
    if (!text || typeof text !== 'string') return { __html: '' };
    const rawHtml = marked(text);
    return { __html: DOMPurify.sanitize(rawHtml) };
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

  if (loading) return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;
  if (!snippet) return <div className="container"><div className="error">SNIPPET НЕ ЗНАЙДЕНО</div></div>;

  const canManage = user && (user.id === snippet.author_id || user.role === 'admin');

  return (
    <div className="container">
      <div className="question-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ marginBottom: 'var(--space-2)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="tag">Snippet</span>
              <span className="badge">{snippet.language}</span>
            </div>
            <h1 className="question-detail-title">{snippet.title}</h1>
            <div className="question-info">
              <span>Опубліковано: {formatDate(snippet.created_at)}</span>
              <span>•</span>
              <span>Переглядів: {snippet.views}</span>
            </div>
          </div>

          {canManage && (
            <div className="question-actions" style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Link to={`/snippets/${snippet.id}/edit`} className="btn btn-secondary btn-sm">РЕДАГУВАТИ</Link>
              <button type="button" onClick={handleDelete} className="btn btn-danger btn-sm">ВИДАЛИТИ</button>
            </div>
          )}
        </div>
      </div>

      <div className="question-detail-card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="question-content" style={{ width: '100%' }}>
          <div className="question-tags" style={{ marginBottom: 'var(--space-3)' }}>
            {Array.isArray(snippet.tags) && snippet.tags.map((tag, index) => (
              <Link key={index} to={`/tags/${tag}`} className="tag">{tag}</Link>
            ))}
          </div>
          <div className="markdown-content" dangerouslySetInnerHTML={renderMarkdown(snippet.description)} />
        </div>
      </div>

      <div className="question-detail-card">
        <div className="question-content" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <strong>КОД</strong>
            <span className="badge">{snippet.language}</span>
          </div>
          <pre style={{ margin: 0, overflowX: 'auto', background: 'var(--color-gray-100)', padding: 'var(--space-4)', border: 'var(--border-width) solid var(--border-color)' }}><code>{snippet.code}</code></pre>
          <div className="question-meta" style={{ marginTop: 'var(--space-4)' }}>
            <Link to={`/users/${snippet.author_id}`} className="author">{snippet.author_name}</Link>
            <span className="separator">•</span>
            <span className="date">knowledge hub / snippet</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SnippetDetail;
