/**
 * Сторінка створення нової статті knowledge hub.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediator } from '../contexts/MediatorContext';
import { useAuth } from '../contexts/AuthContext';
import { EventTypes } from '../../../mediator/src/index';
import { api } from '../services/api';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { AITagSuggester } from '../components/AITagSuggester';
import '../styles/brutalism.css';

export function NewArticle() {
  const navigate = useNavigate();
  const mediator = useMediator();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Заголовок обов\'язковий';
    } else if (title.length < 10) {
      newErrors.title = 'Заголовок має бути мінімум 10 символів';
    }

    if (!excerpt.trim()) {
      newErrors.excerpt = 'Короткий опис обов\'язковий';
    } else if (excerpt.length > 280) {
      newErrors.excerpt = 'Опис має бути до 280 символів';
    }

    if (!body.trim()) {
      newErrors.body = 'Текст статті обов\'язковий';
    } else if (body.length < 80) {
      newErrors.body = 'Текст статті має бути мінімум 80 символів';
    }

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

    if (!user) {
      alert('Увійдіть, щоб створити статтю');
      navigate('/login');
      return;
    }

    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      mediator.emit(EventTypes.USER_ACTION, {
        action: 'create_article',
        tagsCount: tags.length,
      }, 'NewArticle');

      const response = await api.post('/articles', {
        title: title.trim(),
        excerpt: excerpt.trim(),
        body: body.trim(),
        tags,
      });

      const articleData = response.data.data?.article || response.data.article || response.data;

      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'success',
        message: 'Статтю створено',
      }, 'NewArticle');

      navigate(`/articles/${articleData.id}`);
    } catch (error) {
      console.error('Помилка створення статті:', error);

      if (error.response?.data?.errors) {
        const apiErrors = {};
        error.response.data.errors.forEach((err) => {
          apiErrors[err.field] = err.message;
        });
        setErrors(apiErrors);
      } else {
        alert(error.response?.data?.message || 'Помилка створення статті');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>УВІЙДІТЬ, ЩОБ СТВОРИТИ СТАТТЮ</h2>
          <button onClick={() => navigate('/login')} className="btn btn-primary">
            УВІЙТИ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">НОВА СТАТТЯ</h1>
        <p className="page-subtitle">
          Формат knowledge hub для глибоких розборів, пояснень і структурованих матеріалів.
        </p>
      </div>

      <div className="question-card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="question-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span className="tag">Стаття</span>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/create')} disabled={submitting}>
              ІНШІ ФОРМАТИ
            </button>
          </div>
          <p style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
            Використовуйте цей формат для how-to, deep dive, пояснення концепцій і внутрішніх технічних нотаток.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-group">
          <label htmlFor="title" className="form-label">ЗАГОЛОВОК</label>
          <input
            type="text"
            id="title"
            className={`form-input ${errors.title ? 'error' : ''}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Наприклад: Як організувати архітектуру React-проєкту без хаосу"
            maxLength={255}
          />
          {errors.title && <div className="form-error">{errors.title}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="excerpt" className="form-label">КОРОТКИЙ ОПИС</label>
          <textarea
            id="excerpt"
            className={`form-textarea ${errors.excerpt ? 'error' : ''}`}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="2-3 речення, які пояснюють, про що матеріал і для кого він корисний"
            maxLength={280}
            rows={3}
          />
          {errors.excerpt && <div className="form-error">{errors.excerpt}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="body" className="form-label">ТІЛО СТАТТІ</label>
          <MarkdownEditor value={body} onChange={setBody} showPreview={true} />
          {errors.body && <div className="form-error">{errors.body}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="tags" className="form-label">ТЕГИ</label>
          <input
            type="text"
            id="tags"
            className={`form-input ${errors.tags ? 'error' : ''}`}
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="react, architecture, frontend, patterns"
          />
          {errors.tags && <div className="form-error">{errors.tags}</div>}

          <AITagSuggester
            title={title}
            body={body}
            onTagsSelected={(aiTags) => {
              const currentTags = tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : [];
              const newTags = [...new Set([...currentTags, ...aiTags])].slice(0, 8);
              setTagsInput(newTags.join(', '));
            }}
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'ПУБЛІКАЦІЯ...' : 'ОПУБЛІКУВАТИ СТАТТЮ'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/create')} disabled={submitting}>
            СКАСУВАТИ
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewArticle;
