/**
 * Створення новини (admin / moderator).
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { news } from '../services/api';
import { MarkdownEditor } from '../components/MarkdownEditor';
import '../styles/brutalism.css';

export function NewNews() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const canCreate = user && (user.role === 'admin' || user.role === 'moderator');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user && !canCreate) {
      navigate('/news');
    }
  }, [isAuthenticated, user, canCreate, navigate]);

  const validate = () => {
    const next = {};
    if (!title.trim() || title.length < 10) {
      next.title = 'Заголовок — мінімум 10 символів';
    }
    if (!body.trim() || body.length < 80) {
      next.body = 'Текст — мінімум 80 символів';
    }
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length === 0) next.tags = 'Додайте хоча б один тег';
    if (tags.length > 8) next.tags = 'Максимум 8 тегів';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const res = await news.create({ title: title.trim(), body, tags, isPinned });
      const created = res.data?.data?.news;
      const path = created?.slug ? `/news/${created.slug}` : `/news/${created?.id}`;
      navigate(path || '/news');
    } catch (err) {
      alert(err.response?.data?.message || 'Не вдалося опублікувати новину');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canCreate) {
    return <div className="container"><div className="loading">ПЕРЕВІРКА ДОСТУПУ...</div></div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">НОВА НОВИНА</h1>
        <p className="page-subtitle">Публікація у стрічці новин DevFlow</p>
      </div>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label htmlFor="news-title">Заголовок</label>
          <input
            id="news-title"
            type="text"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
          />
          {errors.title && <p className="form-error">{errors.title}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="news-tags">Теги (через кому)</label>
          <input
            id="news-tags"
            type="text"
            className="form-input"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="ai, україна, backend"
          />
          {errors.tags && <p className="form-error">{errors.tags}</p>}
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
            />
            Закріпити вгорі стрічки
          </label>
        </div>

        <div className="form-group">
          <label>Текст новини (Markdown)</label>
          <MarkdownEditor value={body} onChange={setBody} minHeight={280} />
          {errors.body && <p className="form-error">{errors.body}</p>}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'ПУБЛІКАЦІЯ...' : 'ОПУБЛІКУВАТИ'}
          </button>
          <button type="button" className="btn" onClick={() => navigate('/news')}>
            СКАСУВАТИ
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewNews;
