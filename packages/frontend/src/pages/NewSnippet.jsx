/**
 * Сторінка створення нового snippet.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediator } from '../contexts/MediatorContext';
import { useAuth } from '../contexts/AuthContext';
import { EventTypes } from '../../../mediator/src/index';
import { snippets } from '../services/api';
import '../styles/brutalism.css';

const LANGUAGES = ['javascript', 'typescript', 'python', 'php', 'sql', 'html', 'css', 'bash', 'json', 'other'];

export function NewSnippet() {
  const navigate = useNavigate();
  const mediator = useMediator();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [tagsInput, setTagsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!title.trim()) newErrors.title = 'Заголовок обов\'язковий';
    else if (title.length < 5) newErrors.title = 'Заголовок має бути мінімум 5 символів';

    if (!description.trim()) newErrors.description = 'Пояснення snippet обов\'язкове';
    else if (description.length < 20) newErrors.description = 'Пояснення має бути мінімум 20 символів';

    if (!code.trim()) newErrors.code = 'Код обов\'язковий';
    else if (code.length < 3) newErrors.code = 'Додайте корисний фрагмент коду';

    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length === 0) newErrors.tags = 'Додайте хоча б один тег';
    else if (tags.length > 8) newErrors.tags = 'Максимум 8 тегів';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      alert('Увійдіть, щоб створити snippet');
      navigate('/login');
      return;
    }

    if (!validate()) return;

    setSubmitting(true);
    try {
      const tags = tagsInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);

      mediator.emit(EventTypes.USER_ACTION, {
        action: 'create_snippet',
        language,
        tagsCount: tags.length,
      }, 'NewSnippet');

      const response = await snippets.create({
        title: title.trim(),
        description: description.trim(),
        code: code.trim(),
        language,
        tags,
      });

      const snippetData = response.data.data?.snippet || response.data.snippet || response.data;

      mediator.emit(EventTypes.NOTIFICATION, {
        type: 'success',
        message: 'Snippet створено',
      }, 'NewSnippet');

      navigate(`/snippets/${snippetData.id}`);
    } catch (error) {
      console.error('Помилка створення snippet:', error);
      if (error.response?.data?.errors) {
        const apiErrors = {};
        error.response.data.errors.forEach((err) => {
          apiErrors[err.field] = err.message;
        });
        setErrors(apiErrors);
      } else {
        alert(error.response?.data?.message || 'Помилка створення snippet');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>УВІЙДІТЬ, ЩОБ СТВОРИТИ SNIPPET</h2>
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
        <h1 className="page-title">НОВИЙ SNIPPET</h1>
        <p className="page-subtitle">
          Формат knowledge hub для коротких, прикладних фрагментів коду з поясненням і тегами.
        </p>
      </div>

      <div className="question-card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="question-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span className="tag">Snippet</span>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/create')} disabled={submitting}>
              ІНШІ ФОРМАТИ
            </button>
          </div>
          <p style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
            Підходить для готових рішень: конфіги, запити, hooks, util-функції, шаблони компонентів, CLI-команди.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-group">
          <label htmlFor="title" className="form-label">ЗАГОЛОВОК</label>
          <input id="title" className={`form-input ${errors.title ? 'error' : ''}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Наприклад: React hook для debounce значення" maxLength={255} />
          {errors.title && <div className="form-error">{errors.title}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="language" className="form-label">МОВА / ФОРМАТ</label>
          <select id="language" className="form-input" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="description" className="form-label">ПОЯСНЕННЯ</label>
          <textarea id="description" className={`form-textarea ${errors.description ? 'error' : ''}`} value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder="Коли використовувати цей snippet, що він вирішує і які є нюанси." />
          {errors.description && <div className="form-error">{errors.description}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="code" className="form-label">КОД</label>
          <textarea id="code" className={`form-textarea ${errors.code ? 'error' : ''}`} value={code} onChange={(e) => setCode(e.target.value)} rows={14} style={{ fontFamily: 'var(--font-mono)' }} placeholder="function useDebouncedValue(value, delay) { ... }" />
          {errors.code && <div className="form-error">{errors.code}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="tags" className="form-label">ТЕГИ</label>
          <input id="tags" className={`form-input ${errors.tags ? 'error' : ''}`} value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="react, hooks, performance" />
          {errors.tags && <div className="form-error">{errors.tags}</div>}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'ПУБЛІКАЦІЯ...' : 'ОПУБЛІКУВАТИ SNIPPET'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/create')} disabled={submitting}>
            СКАСУВАТИ
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewSnippet;
