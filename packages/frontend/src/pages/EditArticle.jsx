/**
 * Сторінка редагування статті knowledge hub.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { MarkdownEditor } from '../components/MarkdownEditor';
import '../styles/brutalism.css';

export function EditArticle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadArticle();
  }, [id]);

  const loadArticle = async () => {
    try {
      const response = await api.get(`/articles/${id}`);
      const articleData = response.data.data?.article || response.data.article || response.data;

      if (!user || (user.id !== articleData.author_id && user.role !== 'admin')) {
        alert('Ви не можете редагувати цю статтю');
        navigate(`/articles/${id}`);
        return;
      }

      setTitle(articleData.title);
      setExcerpt(articleData.excerpt || '');
      setBody(articleData.body);
      setTagsInput(Array.isArray(articleData.tags) ? articleData.tags.join(', ') : '');
    } catch (error) {
      console.error('Помилка завантаження статті:', error);
      alert('Помилка завантаження статті');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = 'Заголовок обов\'язковий';
    if (!excerpt.trim()) newErrors.excerpt = 'Короткий опис обов\'язковий';
    if (!body.trim() || body.length < 80) newErrors.body = 'Текст статті має бути мінімум 80 символів';

    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length === 0) {
      newErrors.tags = 'Додайте хоча б один тег';
    } else if (tags.length > 8) {
      newErrors.tags = 'Максимум 8 тегів';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const tags = tagsInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      await api.put(`/articles/${id}`, {
        title: title.trim(),
        excerpt: excerpt.trim(),
        body: body.trim(),
        tags,
      });
      navigate(`/articles/${id}`);
    } catch (error) {
      console.error('Помилка оновлення статті:', error);
      if (error.response?.data?.errors) {
        const apiErrors = {};
        error.response.data.errors.forEach((err) => {
          apiErrors[err.field] = err.message;
        });
        setErrors(apiErrors);
      } else {
        alert(error.response?.data?.message || 'Помилка оновлення статті');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>УВІЙДІТЬ, ЩОБ РЕДАГУВАТИ СТАТТЮ</h2>
          <button onClick={() => navigate('/login')} className="btn btn-primary">УВІЙТИ</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">РЕДАГУВАТИ СТАТТЮ</h1>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-group">
          <label htmlFor="title" className="form-label">ЗАГОЛОВОК</label>
          <input id="title" className={`form-input ${errors.title ? 'error' : ''}`} value={title} onChange={(e) => setTitle(e.target.value)} />
          {errors.title && <div className="form-error">{errors.title}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="excerpt" className="form-label">КОРОТКИЙ ОПИС</label>
          <textarea id="excerpt" className={`form-textarea ${errors.excerpt ? 'error' : ''}`} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} />
          {errors.excerpt && <div className="form-error">{errors.excerpt}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="body" className="form-label">ТІЛО СТАТТІ</label>
          <MarkdownEditor value={body} onChange={setBody} showPreview={true} />
          {errors.body && <div className="form-error">{errors.body}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="tags" className="form-label">ТЕГИ</label>
          <input id="tags" className={`form-input ${errors.tags ? 'error' : ''}`} value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          {errors.tags && <div className="form-error">{errors.tags}</div>}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'ЗБЕРЕЖЕННЯ...' : 'ЗБЕРЕГТИ ЗМІНИ'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/articles/${id}`)} disabled={submitting}>
            СКАСУВАТИ
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditArticle;
