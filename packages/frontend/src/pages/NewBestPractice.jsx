/**
 * Сторінка створення нової найкращої практики (knowledge hub).
 * Поля повторюють контракт POST /api/best-practices (express-validator у backend).
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediator } from '../contexts/MediatorContext';
import { useAuth } from '../contexts/AuthContext';
import { EventTypes } from '../../../mediator/src/index';
import { bestPractices } from '../services/api';
import { MarkdownEditor } from '../components/MarkdownEditor';
import '../styles/brutalism.css';

export function NewBestPractice() {
  const navigate = useNavigate();
  const mediator = useMediator();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [rule, setRule] = useState('');
  const [body, setBody] = useState('');
  const [antiPatterns, setAntiPatterns] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const addTag = () => {
    const value = tagInput.trim().toLowerCase();
    if (!value) return;
    if (tags.includes(value)) {
      setTagInput('');
      return;
    }
    if (tags.length >= 8) return;
    setTags([...tags, value]);
    setTagInput('');
  };

  const removeTag = (tag) => setTags(tags.filter((t) => t !== tag));

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = 'Заголовок обов\'язковий';
    else if (title.length < 10) newErrors.title = 'Заголовок має бути мінімум 10 символів';

    if (!rule.trim()) newErrors.rule = 'Правило обов\'язкове';
    else if (rule.trim().length < 10) newErrors.rule = 'Правило має бути мінімум 10 символів';
    else if (rule.length > 500) newErrors.rule = 'Правило не довше за 500 символів';

    if (!body.trim()) newErrors.body = 'Опис обов\'язковий';
    else if (body.length < 80) newErrors.body = 'Опис має бути мінімум 80 символів';

    if (category && category.length > 80) newErrors.category = 'Категорія не довша за 80 символів';

    if (tags.length === 0) newErrors.tags = 'Додайте хоча б один тег';
    else if (tags.length > 8) newErrors.tags = 'Максимум 8 тегів';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('Увійдіть, щоб створити найкращу практику');
      navigate('/login');
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        rule: rule.trim(),
        body: body.trim(),
        tags,
      };
      const trimmedAnti = antiPatterns.trim();
      if (trimmedAnti) payload.antiPatterns = trimmedAnti;
      const trimmedCategory = category.trim();
      if (trimmedCategory) payload.category = trimmedCategory;

      mediator.emit(EventTypes.USER_ACTION, {
        action: 'create_best_practice',
        tagsCount: tags.length,
        hasAntiPatterns: Boolean(trimmedAnti),
        hasCategory: Boolean(trimmedCategory),
      }, 'NewBestPractice');

      const response = await bestPractices.create(payload);
      const bpData = response.data.data?.bestPractice || response.data.bestPractice || response.data;

      mediator.emit(EventTypes.NOTIFICATION, { type: 'success', message: 'Найкращу практику створено' }, 'NewBestPractice');
      navigate(`/best-practices/${bpData.id}`);
    } catch (error) {
      console.error('Помилка створення найкращої практики:', error);
      if (error.response?.data?.errors) {
        const apiErrors = {};
        error.response.data.errors.forEach((err) => {
          apiErrors[err.field] = err.message;
        });
        setErrors(apiErrors);
      } else {
        alert(error.response?.data?.message || 'Помилка створення найкращої практики');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>УВІЙДІТЬ, ЩОБ СТВОРИТИ НАЙКРАЩУ ПРАКТИКУ</h2>
          <button onClick={() => navigate('/login')} className="btn btn-primary">УВІЙТИ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">НОВА НАЙКРАЩА ПРАКТИКА</h1>
        <p className="page-subtitle">
          Перевірений підхід, правило або шаблон. Включає коротке формулювання правила та розгорнутий розбір.
        </p>
      </div>

      <div className="question-card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="question-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span className="tag">Найкраща практика</span>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/create')} disabled={submitting}>
              ІНШІ ФОРМАТИ
            </button>
          </div>
          <p style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
            Використовуйте для правил архітектури, чеклистів перегляду коду, антипатернів і командних угод.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-group">
          <label htmlFor="title" className="form-label">ЗАГОЛОВОК</label>
          <input
            id="title"
            type="text"
            className={`form-input ${errors.title ? 'error' : ''}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Наприклад: Завжди обмежуйте розмір React-компонента до 200 рядків"
            maxLength={255}
          />
          {errors.title && <div className="form-error">{errors.title}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="rule" className="form-label">ПРАВИЛО (1-2 речення)</label>
          <textarea
            id="rule"
            className={`form-textarea ${errors.rule ? 'error' : ''}`}
            value={rule}
            onChange={(e) => setRule(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Сформулюйте правило коротко і однозначно."
          />
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
            {rule.length} / 500
          </div>
          {errors.rule && <div className="form-error">{errors.rule}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="category" className="form-label">КАТЕГОРІЯ (опційно)</label>
          <input
            id="category"
            type="text"
            className={`form-input ${errors.category ? 'error' : ''}`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Архітектура, тестування, безпека..."
            maxLength={80}
          />
          {errors.category && <div className="form-error">{errors.category}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="body" className="form-label">РОЗГОРНУТИЙ ОПИС</label>
          <MarkdownEditor value={body} onChange={setBody} showPreview={true} />
          {errors.body && <div className="form-error">{errors.body}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="antiPatterns" className="form-label">АНТИПАТЕРНИ (опційно)</label>
          <textarea
            id="antiPatterns"
            className="form-textarea"
            value={antiPatterns}
            onChange={(e) => setAntiPatterns(e.target.value)}
            rows={5}
            placeholder="Чого варто уникати, типові помилки, приклади 'як не треба'."
          />
        </div>

        <div className="form-group">
          <label htmlFor="tag-input" className="form-label">ТЕГИ</label>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input
              id="tag-input"
              type="text"
              className={`form-input ${errors.tags ? 'error' : ''}`}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="react, перевірка-коду, архітектура"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={addTag}
              disabled={!tagInput.trim() || tags.length >= 8 || submitting}
            >
              + ТЕГ
            </button>
          </div>
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              {tags.map((tag) => (
                <span key={tag} className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                    }}
                    aria-label={`Видалити тег ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {errors.tags && <div className="form-error">{errors.tags}</div>}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'ПУБЛІКАЦІЯ...' : 'СТВОРИТИ НАЙКРАЩУ ПРАКТИКУ'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/create')} disabled={submitting}>
            СКАСУВАТИ
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewBestPractice;
