/**
 * Сторінка створення нового guide.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediator } from '../contexts/MediatorContext';
import { useAuth } from '../contexts/AuthContext';
import { EventTypes } from '../../../mediator/src/index';
import { guides } from '../services/api';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { AITagSuggester } from '../components/AITagSuggester';
import '../styles/brutalism.css';

const DIFFICULTIES = [
  { value: 'beginner', label: 'Початковий' },
  { value: 'intermediate', label: 'Середній' },
  { value: 'advanced', label: 'Просунутий' },
];

export function NewGuide() {
  const navigate = useNavigate();
  const mediator = useMediator();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [difficulty, setDifficulty] = useState('beginner');
  const [estimatedMinutes, setEstimatedMinutes] = useState(15);
  const [tagsInput, setTagsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = 'Заголовок обов\'язковий';
    else if (title.length < 10) newErrors.title = 'Заголовок має бути мінімум 10 символів';
    if (!summary.trim()) newErrors.summary = 'Короткий опис обов\'язковий';
    else if (summary.length < 20) newErrors.summary = 'Опис має бути мінімум 20 символів';
    if (!body.trim()) newErrors.body = 'Тіло гайду обов\'язкове';
    else if (body.length < 80) newErrors.body = 'Тіло гайду має бути мінімум 80 символів';
    if (!estimatedMinutes || Number(estimatedMinutes) < 1) newErrors.estimatedMinutes = 'Вкажіть орієнтовний час';

    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length === 0) newErrors.tags = 'Додайте хоча б один тег';
    else if (tags.length > 8) newErrors.tags = 'Максимум 8 тегів';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('Увійдіть, щоб створити гайд');
      navigate('/login');
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      const tags = tagsInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      mediator.emit(EventTypes.USER_ACTION, {
        action: 'create_guide',
        difficulty,
        estimatedMinutes: Number(estimatedMinutes),
        tagsCount: tags.length,
      }, 'NewGuide');

      const response = await guides.create({
        title: title.trim(),
        summary: summary.trim(),
        body: body.trim(),
        difficulty,
        estimatedMinutes: Number(estimatedMinutes),
        tags,
      });

      const guideData = response.data.data?.guide || response.data.guide || response.data;
      mediator.emit(EventTypes.NOTIFICATION, { type: 'success', message: 'Гайд створено' }, 'NewGuide');
      navigate(`/guides/${guideData.id}`);
    } catch (error) {
      console.error('Помилка створення гайду:', error);
      if (error.response?.data?.errors) {
        const apiErrors = {};
        error.response.data.errors.forEach((err) => {
          apiErrors[err.field] = err.message;
        });
        setErrors(apiErrors);
      } else {
        alert(error.response?.data?.message || 'Помилка створення гайду');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container"><div className="empty-state"><h2>УВІЙДІТЬ, ЩОБ СТВОРИТИ ГАЙД</h2><button onClick={() => navigate('/login')} className="btn btn-primary">УВІЙТИ</button></div></div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">НОВИЙ ГАЙД</h1>
        <p className="page-subtitle">Структурований how-to формат для покрокових інструкцій, онбордингу та навчальних маршрутів.</p>
      </div>

      <div className="question-card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="question-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span className="tag">Гайд</span>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/create')} disabled={submitting}>ІНШІ ФОРМАТИ</button>
          </div>
          <p style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
            Використовуйте цей формат для tutorial, onboarding, setup-посібників і покрокових технічних інструкцій.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-group">
          <label htmlFor="title" className="form-label">ЗАГОЛОВОК</label>
          <input id="title" className={`form-input ${errors.title ? 'error' : ''}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Наприклад: Як підняти локальне середовище React + Express з нуля" />
          {errors.title && <div className="form-error">{errors.title}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="summary" className="form-label">КОРОТКИЙ ОПИС</label>
          <textarea id="summary" className={`form-textarea ${errors.summary ? 'error' : ''}`} value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="Що отримає читач і для кого цей гайд." />
          {errors.summary && <div className="form-error">{errors.summary}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
          <div className="form-group">
            <label htmlFor="difficulty" className="form-label">СКЛАДНІСТЬ</label>
            <select id="difficulty" className="form-input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              {DIFFICULTIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="estimatedMinutes" className="form-label">ЧАС, ХВ</label>
            <input id="estimatedMinutes" type="number" min="1" max="600" className={`form-input ${errors.estimatedMinutes ? 'error' : ''}`} value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} />
            {errors.estimatedMinutes && <div className="form-error">{errors.estimatedMinutes}</div>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="body" className="form-label">ТІЛО ГАЙДУ</label>
          <MarkdownEditor value={body} onChange={setBody} showPreview={true} />
          {errors.body && <div className="form-error">{errors.body}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="tags" className="form-label">ТЕГИ</label>
          <input id="tags" className={`form-input ${errors.tags ? 'error' : ''}`} value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="react, setup, express, deployment" />
          {errors.tags && <div className="form-error">{errors.tags}</div>}
          <AITagSuggester
            title={title}
            body={`${summary}\n\n${body}`}
            onTagsSelected={(aiTags) => {
              const currentTags = tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : [];
              const newTags = [...new Set([...currentTags, ...aiTags])].slice(0, 8);
              setTagsInput(newTags.join(', '));
            }}
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'ПУБЛІКАЦІЯ...' : 'ОПУБЛІКУВАТИ ГАЙД'}</button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/create')} disabled={submitting}>СКАСУВАТИ</button>
        </div>
      </form>
    </div>
  );
}

export default NewGuide;
