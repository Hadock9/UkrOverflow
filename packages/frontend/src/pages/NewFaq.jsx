/**
 * Сторінка створення нового ЧаП у knowledge hub.
 * Поля повторюють контракт POST /api/faqs (express-validator у backend).
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediator } from '../contexts/MediatorContext';
import { useAuth } from '../contexts/AuthContext';
import { EventTypes } from '../../../mediator/src/index';
import { faqs } from '../services/api';
import { MarkdownEditor } from '../components/MarkdownEditor';
import '../styles/brutalism.css';

const EMPTY_PAIR = () => ({ question: '', answer: '' });

export function NewFaq() {
  const navigate = useNavigate();
  const mediator = useMediator();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [body, setBody] = useState('');
  const [qaPairs, setQaPairs] = useState([{ question: '', answer: '' }]);
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

  const updatePair = (index, field, value) => {
    setQaPairs((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const addPair = () => {
    setQaPairs((prev) => [...prev, EMPTY_PAIR()]);
  };

  const removePair = (index) => {
    setQaPairs((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const validate = () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = 'Заголовок обов\'язковий';
    else if (title.length < 10) newErrors.title = 'Заголовок має бути мінімум 10 символів';

    if (!topic.trim()) newErrors.topic = 'Тема обов\'язкова';
    else if (topic.trim().length < 2) newErrors.topic = 'Тема має бути мінімум 2 символи';
    else if (topic.length > 120) newErrors.topic = 'Тема не довша за 120 символів';

    if (!body.trim()) newErrors.body = 'Опис обов\'язковий';
    else if (body.length < 80) newErrors.body = 'Опис має бути мінімум 80 символів';

    if (qaPairs.length < 1) newErrors.qaPairs = 'Мінімум одна пара питання/відповідь';
    else {
      const badIdx = qaPairs.findIndex((p) => !p.question.trim() || !p.answer.trim());
      if (badIdx >= 0) newErrors.qaPairs = `Заповніть питання й відповідь у парі ${badIdx + 1}`;
    }

    if (tags.length === 0) newErrors.tags = 'Додайте хоча б один тег';
    else if (tags.length > 8) newErrors.tags = 'Максимум 8 тегів';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('Увійдіть, щоб створити ЧаП');
      navigate('/login');
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        topic: topic.trim(),
        body: body.trim(),
        qaPairs: qaPairs.map((p) => ({
          question: p.question.trim(),
          answer: p.answer.trim(),
        })),
        tags,
      };

      mediator.emit(EventTypes.USER_ACTION, {
        action: 'create_faq',
        pairsCount: payload.qaPairs.length,
        tagsCount: tags.length,
      }, 'NewFaq');

      const response = await faqs.create(payload);
      const faqData = response.data.data?.faq || response.data.faq || response.data;

      mediator.emit(EventTypes.NOTIFICATION, { type: 'success', message: 'ЧаП створено' }, 'NewFaq');
      navigate(`/faqs/${faqData.id}`);
    } catch (error) {
      console.error('Помилка створення ЧаП:', error);
      if (error.response?.data?.errors) {
        const apiErrors = {};
        error.response.data.errors.forEach((err) => {
          apiErrors[err.field] = err.message;
        });
        setErrors(apiErrors);
      } else {
        alert(error.response?.data?.message || 'Помилка створення ЧаП');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>УВІЙДІТЬ, ЩОБ СТВОРИТИ ЧаП</h2>
          <button onClick={() => navigate('/login')} className="btn btn-primary">УВІЙТИ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">НОВИЙ ЧаП</h1>
        <p className="page-subtitle">
          Збірка часто-питаних запитань і компактних відповідей по конкретній темі чи технології.
        </p>
      </div>

      <div className="question-card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="question-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span className="tag">ЧаП</span>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/create')} disabled={submitting}>
              ІНШІ ФОРМАТИ
            </button>
          </div>
          <p style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
            Підходить для вступної документації, технологічних шпаргалок і відповідей на типові запитання.
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
            placeholder="Наприклад: ЧаП із налаштування Vite + React"
            maxLength={255}
          />
          {errors.title && <div className="form-error">{errors.title}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="topic" className="form-label">ТЕМА</label>
          <input
            id="topic"
            type="text"
            className={`form-input ${errors.topic ? 'error' : ''}`}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="React, Docker, Postgres, Vite..."
            maxLength={120}
          />
          {errors.topic && <div className="form-error">{errors.topic}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="body" className="form-label">ВСТУПНИЙ ОПИС</label>
          <MarkdownEditor value={body} onChange={setBody} showPreview={true} />
          {errors.body && <div className="form-error">{errors.body}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">ПИТАННЯ ТА ВІДПОВІДІ</label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {qaPairs.map((pair, index) => (
              <div
                key={index}
                style={{
                  border: '3px solid #000',
                  background: '#fff',
                  padding: 'var(--space-3)',
                  boxShadow: '4px 4px 0 #000',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <strong style={{ fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>
                    ПАРА #{index + 1}
                  </strong>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => removePair(index)}
                    disabled={qaPairs.length <= 1 || submitting}
                    title={qaPairs.length <= 1 ? 'Мінімум одна пара' : 'Видалити пару'}
                  >
                    ВИДАЛИТИ
                  </button>
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                  <label className="form-label">ПИТАННЯ</label>
                  <input
                    type="text"
                    className="form-input"
                    value={pair.question}
                    onChange={(e) => updatePair(index, 'question', e.target.value)}
                    placeholder="Як працює швидке оновлення (fast refresh) у Vite?"
                    maxLength={500}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">ВІДПОВІДЬ</label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    value={pair.answer}
                    onChange={(e) => updatePair(index, 'answer', e.target.value)}
                    placeholder="Коротка і конкретна відповідь з прикладами або посиланнями."
                  />
                </div>
              </div>
            ))}
          </div>

          {errors.qaPairs && <div className="form-error" style={{ marginTop: 'var(--space-2)' }}>{errors.qaPairs}</div>}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={addPair}
            disabled={submitting || qaPairs.length >= 50}
            style={{ marginTop: 'var(--space-3)' }}
          >
            + ДОДАТИ ПАРУ
          </button>
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
              placeholder="vite, react, чап"
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
            {submitting ? 'ПУБЛІКАЦІЯ...' : 'СТВОРИТИ ЧаП'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/create')} disabled={submitting}>
            СКАСУВАТИ
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewFaq;
