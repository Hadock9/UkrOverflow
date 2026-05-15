/**
 * Редагування навчального маршруту.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { roadmaps } from '../services/api';
import { MarkdownEditor } from '../components/MarkdownEditor';
import '../styles/brutalism.css';

const DIFFICULTIES = [
  { value: 'beginner', label: 'Початковий' },
  { value: 'intermediate', label: 'Середній' },
  { value: 'advanced', label: 'Просунутий' },
];

const EMPTY_STEP = () => ({ order: 1, title: '', description: '', estimated_weeks: 1 });

function parseSteps(raw) {
  if (!raw) return [EMPTY_STEP(), { ...EMPTY_STEP(), order: 2 }];
  let steps = raw;
  if (typeof steps === 'string') {
    try {
      steps = JSON.parse(steps);
    } catch {
      steps = [];
    }
  }
  if (!Array.isArray(steps) || steps.length < 2) {
    return [EMPTY_STEP(), { ...EMPTY_STEP(), order: 2 }];
  }
  return steps.map((s, i) => ({
    order: s.order ?? i + 1,
    title: s.title || '',
    description: s.description || '',
    estimated_weeks: s.estimated_weeks ?? s.estimatedWeeks ?? 1,
  }));
}

export function EditRoadmap() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [difficulty, setDifficulty] = useState('beginner');
  const [estimatedWeeks, setEstimatedWeeks] = useState(8);
  const [steps, setSteps] = useState([EMPTY_STEP(), { ...EMPTY_STEP(), order: 2 }]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadItem();
  }, [id]);

  const loadItem = async () => {
    try {
      const response = await roadmaps.get(id);
      const item = response.data.data?.roadmap || response.data.roadmap || response.data;
      if (!user || (user.id !== item.author_id && user.role !== 'admin')) {
        alert('Ви не можете редагувати цей маршрут');
        navigate(`/roadmaps/${id}`);
        return;
      }
      setTitle(item.title || '');
      setSummary(item.summary || item.excerpt || '');
      setBody(item.body || '');
      setDifficulty(item.difficulty || 'beginner');
      setEstimatedWeeks(item.estimated_weeks ?? item.estimatedWeeks ?? 8);
      setSteps(parseSteps(item.steps));
      setTags(Array.isArray(item.tags) ? item.tags : []);
    } catch (error) {
      console.error(error);
      alert('Помилка завантаження');
      navigate('/roadmaps');
    } finally {
      setLoading(false);
    }
  };

  const addTag = () => {
    const value = tagInput.trim().toLowerCase();
    if (!value || tags.includes(value) || tags.length >= 8) return;
    setTags([...tags, value]);
    setTagInput('');
  };

  const updateStep = (index, field, value) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { ...EMPTY_STEP(), order: prev.length + 1 }]);
  };

  const removeStep = (index) => {
    setSteps((prev) => {
      if (prev.length <= 2) return prev;
      const next = prev.filter((_, i) => i !== index);
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const validate = () => {
    const next = {};
    if (!title.trim()) next.title = 'Заголовок обов\'язковий';
    else if (title.length < 10) next.title = 'Заголовок має бути мінімум 10 символів';
    if (!summary.trim()) next.summary = 'Короткий опис обов\'язковий';
    else if (summary.length < 20) next.summary = 'Опис має бути мінімум 20 символів';
    if (!body.trim() || body.length < 80) next.body = 'Опис має бути мінімум 80 символів';
    const weeks = Number(estimatedWeeks);
    if (!weeks || weeks < 1 || weeks > 156) next.estimatedWeeks = 'Введіть від 1 до 156 тижнів';
    if (steps.length < 2) next.steps = 'Мінімум 2 кроки';
    else {
      const badIdx = steps.findIndex((s) => !s.title.trim() || !s.description.trim());
      if (badIdx >= 0) next.steps = `Заповніть заголовок і опис для кроку ${badIdx + 1}`;
    }
    if (tags.length === 0) next.tags = 'Додайте хоча б один тег';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      await roadmaps.update(id, payload);
      navigate(`/roadmaps/${id}`);
    } catch (error) {
      alert(error.response?.data?.message || 'Помилка збереження');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>УВІЙДІТЬ, ЩОБ РЕДАГУВАТИ МАРШРУТ</h2>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>УВІЙТИ</button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">РЕДАГУВАТИ НАВЧАЛЬНИЙ МАРШРУТ</h1>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-group">
          <label htmlFor="title" className="form-label">ЗАГОЛОВОК</label>
          <input id="title" className={`form-input ${errors.title ? 'error' : ''}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} />
          {errors.title && <div className="form-error">{errors.title}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="summary" className="form-label">КОРОТКИЙ ОПИС</label>
          <textarea id="summary" className={`form-textarea ${errors.summary ? 'error' : ''}`} value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={280} />
          {errors.summary && <div className="form-error">{errors.summary}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
          <div className="form-group">
            <label htmlFor="difficulty" className="form-label">СКЛАДНІСТЬ</label>
            <select id="difficulty" className="form-input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              {DIFFICULTIES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="estimatedWeeks" className="form-label">ОРІЄНТОВНО, ТИЖНІВ</label>
            <input id="estimatedWeeks" type="number" min="1" max="156" className={`form-input ${errors.estimatedWeeks ? 'error' : ''}`} value={estimatedWeeks} onChange={(e) => setEstimatedWeeks(e.target.value)} />
            {errors.estimatedWeeks && <div className="form-error">{errors.estimatedWeeks}</div>}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">ОПИС МАРШРУТУ</label>
          <MarkdownEditor value={body} onChange={setBody} showPreview />
          {errors.body && <div className="form-error">{errors.body}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">КРОКИ МАРШРУТУ</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {steps.map((step, index) => (
              <div key={index} style={{ border: '3px solid #000', background: '#fff', padding: 'var(--space-3)', boxShadow: '4px 4px 0 #000' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <strong style={{ fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>КРОК {index + 1}</strong>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeStep(index)} disabled={steps.length <= 2 || submitting}>ВИДАЛИТИ</button>
                </div>
                <input type="text" className="form-input" value={step.title} onChange={(e) => updateStep(index, 'title', e.target.value)} placeholder="Заголовок кроку" style={{ marginBottom: 8 }} />
                <textarea className="form-textarea" rows={3} value={step.description} onChange={(e) => updateStep(index, 'description', e.target.value)} placeholder="Опис кроку" style={{ marginBottom: 8 }} />
                <input type="number" min="1" max="156" className="form-input" value={step.estimated_weeks} onChange={(e) => updateStep(index, 'estimated_weeks', e.target.value)} />
              </div>
            ))}
          </div>
          {errors.steps && <div className="form-error" style={{ marginTop: 'var(--space-2)' }}>{errors.steps}</div>}
          <button type="button" className="btn btn-secondary" onClick={addStep} disabled={submitting || steps.length >= 50} style={{ marginTop: 'var(--space-3)' }}>+ ДОДАТИ КРОК</button>
        </div>

        <div className="form-group">
          <label htmlFor="tag-input" className="form-label">ТЕГИ</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input id="tag-input" className={`form-input ${errors.tags ? 'error' : ''}`} value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} style={{ flex: 1 }} />
            <button type="button" className="btn btn-secondary" onClick={addTag}>+ ТЕГ</button>
          </div>
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {tags.map((tag) => (
                <span key={tag} className="tag tag-removable">
                  {tag}
                  <button type="button" className="tag-remove" onClick={() => setTags(tags.filter((t) => t !== tag))} aria-label={`Видалити ${tag}`}>×</button>
                </span>
              ))}
            </div>
          )}
          {errors.tags && <div className="form-error">{errors.tags}</div>}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'ЗБЕРЕЖЕННЯ...' : 'ЗБЕРЕГТИ'}</button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/roadmaps/${id}`)} disabled={submitting}>СКАСУВАТИ</button>
        </div>
      </form>
    </div>
  );
}

export default EditRoadmap;
