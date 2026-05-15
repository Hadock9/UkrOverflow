/**
 * Сторінка створення нового навчального маршруту knowledge hub.
 * Поля повторюють контракт POST /api/roadmaps (express-validator у backend).
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediator } from '../contexts/MediatorContext';
import { useAuth } from '../contexts/AuthContext';
import { EventTypes } from '../../../mediator/src/index';
import { roadmaps } from '../services/api';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { AIRoadmapGenerator } from '../components/AIRoadmapGenerator';
import '../styles/brutalism.css';

const DIFFICULTIES = [
  { value: 'beginner', label: 'Початковий' },
  { value: 'intermediate', label: 'Середній' },
  { value: 'advanced', label: 'Просунутий' },
];

const EMPTY_STEP = () => ({ order: 1, title: '', description: '', estimated_weeks: 1 });

export function NewRoadmap() {
  const navigate = useNavigate();
  const mediator = useMediator();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [difficulty, setDifficulty] = useState('beginner');
  const [estimatedWeeks, setEstimatedWeeks] = useState(8);
  const [steps, setSteps] = useState([
    { order: 1, title: '', description: '', estimated_weeks: 1 },
    { order: 2, title: '', description: '', estimated_weeks: 1 },
  ]);
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

  const updateStep = (index, field, value) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      { ...EMPTY_STEP(), order: prev.length + 1 },
    ]);
  };

  const removeStep = (index) => {
    setSteps((prev) => {
      if (prev.length <= 2) return prev;
      const next = prev.filter((_, i) => i !== index);
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const validate = () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = 'Заголовок обов\'язковий';
    else if (title.length < 10) newErrors.title = 'Заголовок має бути мінімум 10 символів';

    if (!summary.trim()) newErrors.summary = 'Короткий опис обов\'язковий';
    else if (summary.length < 20) newErrors.summary = 'Опис має бути мінімум 20 символів';
    else if (summary.length > 280) newErrors.summary = 'Опис не довший за 280 символів';

    if (!body.trim()) newErrors.body = 'Опис навчального маршруту обов\'язковий';
    else if (body.length < 80) newErrors.body = 'Опис має бути мінімум 80 символів';

    const weeks = Number(estimatedWeeks);
    if (!weeks || weeks < 1 || weeks > 156) newErrors.estimatedWeeks = 'Введіть від 1 до 156 тижнів';

    if (steps.length < 2) newErrors.steps = 'Мінімум 2 кроки';
    else {
      const badIdx = steps.findIndex((s) => !s.title.trim() || !s.description.trim());
      if (badIdx >= 0) newErrors.steps = `Заповніть заголовок і опис для кроку ${badIdx + 1}`;
    }

    if (tags.length === 0) newErrors.tags = 'Додайте хоча б один тег';
    else if (tags.length > 8) newErrors.tags = 'Максимум 8 тегів';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('Увійдіть, щоб створити навчальний маршрут');
      navigate('/login');
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        summary: summary.trim(),
        body: body.trim(),
        difficulty,
        estimatedWeeks: Number(estimatedWeeks),
        steps: steps.map((s, i) => ({
          order: i + 1,
          title: s.title.trim(),
          description: s.description.trim(),
          estimated_weeks: Number(s.estimated_weeks) || 1,
        })),
        tags,
      };

      mediator.emit(EventTypes.USER_ACTION, {
        action: 'create_roadmap',
        difficulty,
        estimatedWeeks: payload.estimatedWeeks,
        stepsCount: payload.steps.length,
        tagsCount: tags.length,
      }, 'NewRoadmap');

      const response = await roadmaps.create(payload);
      const roadmapData = response.data.data?.roadmap || response.data.roadmap || response.data;

      mediator.emit(EventTypes.NOTIFICATION, { type: 'success', message: 'Маршрут створено' }, 'NewRoadmap');
      navigate(`/roadmaps/${roadmapData.id}`);
    } catch (error) {
      console.error('Помилка створення маршруту:', error);
      if (error.response?.data?.errors) {
        const apiErrors = {};
        error.response.data.errors.forEach((err) => {
          apiErrors[err.field] = err.message;
        });
        setErrors(apiErrors);
      } else {
        alert(error.response?.data?.message || 'Помилка створення маршруту');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>УВІЙДІТЬ, ЩОБ СТВОРИТИ МАРШРУТ</h2>
          <button onClick={() => navigate('/login')} className="btn btn-primary">УВІЙТИ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">НОВИЙ НАВЧАЛЬНИЙ МАРШРУТ</h1>
        <p className="page-subtitle">
          Навчальний маршрут зі структурованими кроками — від точки А до точки Б.
        </p>
      </div>

      <div className="question-card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="question-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span className="tag">Маршрут</span>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/create')} disabled={submitting}>
              ІНШІ ФОРМАТИ
            </button>
          </div>
          <p style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
            Підходить для трекерів навчання, кар'єрних шляхів і поетапних планів освоєння технології.
          </p>
        </div>
      </div>

      <AIRoadmapGenerator
        difficulty={difficulty}
        onGenerated={(roadmap) => {
          if (roadmap.title) setTitle(roadmap.title);
          if (roadmap.summary) setSummary(roadmap.summary);
          if (roadmap.body) setBody(roadmap.body);
          if (roadmap.difficulty) setDifficulty(roadmap.difficulty);
          if (roadmap.estimated_weeks) setEstimatedWeeks(roadmap.estimated_weeks);
          if (roadmap.tags?.length) setTags(roadmap.tags);
          if (roadmap.steps?.length >= 2) {
            setSteps(
              roadmap.steps.map((s, i) => ({
                order: s.order ?? i + 1,
                title: s.title || '',
                description: s.description || '',
                estimated_weeks: s.estimated_weeks ?? 1,
              })),
            );
          }
        }}
      />

      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-group">
          <label htmlFor="title" className="form-label">ЗАГОЛОВОК</label>
          <input
            id="title"
            type="text"
            className={`form-input ${errors.title ? 'error' : ''}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Наприклад: навчальний маршрут фронтенд-розробника 2026"
            maxLength={255}
          />
          {errors.title && <div className="form-error">{errors.title}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="summary" className="form-label">КОРОТКИЙ ОПИС</label>
          <textarea
            id="summary"
            className={`form-textarea ${errors.summary ? 'error' : ''}`}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            maxLength={280}
            placeholder="Для кого цей маршрут, який рівень на виході і скільки часу займе."
          />
          {errors.summary && <div className="form-error">{errors.summary}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
          <div className="form-group">
            <label htmlFor="difficulty" className="form-label">СКЛАДНІСТЬ</label>
            <select
              id="difficulty"
              className="form-input"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              {DIFFICULTIES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="estimatedWeeks" className="form-label">ОРІЄНТОВНО, ТИЖНІВ</label>
            <input
              id="estimatedWeeks"
              type="number"
              min="1"
              max="156"
              className={`form-input ${errors.estimatedWeeks ? 'error' : ''}`}
              value={estimatedWeeks}
              onChange={(e) => setEstimatedWeeks(e.target.value)}
            />
            {errors.estimatedWeeks && <div className="form-error">{errors.estimatedWeeks}</div>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="body" className="form-label">ОПИС МАРШРУТУ</label>
          <MarkdownEditor value={body} onChange={setBody} showPreview={true} />
          {errors.body && <div className="form-error">{errors.body}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">КРОКИ МАРШРУТУ</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {steps.map((step, index) => (
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
                    КРОК {index + 1}
                  </strong>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => removeStep(index)}
                    disabled={steps.length <= 2 || submitting}
                    title={steps.length <= 2 ? 'Мінімум 2 кроки' : 'Видалити крок'}
                  >
                    ВИДАЛИТИ
                  </button>
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                  <label className="form-label">ЗАГОЛОВОК КРОКУ</label>
                  <input
                    type="text"
                    className="form-input"
                    value={step.title}
                    onChange={(e) => updateStep(index, 'title', e.target.value)}
                    placeholder="HTML, CSS, основи верстки"
                    maxLength={200}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                  <label className="form-label">ОПИС КРОКУ</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={step.description}
                    onChange={(e) => updateStep(index, 'description', e.target.value)}
                    placeholder="Що саме вивчити, які матеріали пройти, який практичний вихід."
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0, maxWidth: 220 }}>
                  <label className="form-label">ТИЖНІВ НА КРОК</label>
                  <input
                    type="number"
                    min="1"
                    max="156"
                    className="form-input"
                    value={step.estimated_weeks}
                    onChange={(e) => updateStep(index, 'estimated_weeks', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          {errors.steps && <div className="form-error" style={{ marginTop: 'var(--space-2)' }}>{errors.steps}</div>}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={addStep}
            disabled={submitting || steps.length >= 50}
            style={{ marginTop: 'var(--space-3)' }}
          >
            + ДОДАТИ КРОК
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
              placeholder="javascript, react, навчальний-маршрут"
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
                <span
                  key={tag}
                  className="tag"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
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
            {submitting ? 'ПУБЛІКАЦІЯ...' : 'СТВОРИТИ МАРШРУТ'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/create')} disabled={submitting}>
            СКАСУВАТИ
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewRoadmap;
