/**
 * Сторінка редагування guide.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { guides } from '../services/api';
import { MarkdownEditor } from '../components/MarkdownEditor';
import '../styles/brutalism.css';

const DIFFICULTIES = [
  { value: 'beginner', label: 'Початковий' },
  { value: 'intermediate', label: 'Середній' },
  { value: 'advanced', label: 'Просунутий' },
];

export function EditGuide() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [difficulty, setDifficulty] = useState('beginner');
  const [estimatedMinutes, setEstimatedMinutes] = useState(15);
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadGuide();
  }, [id]);

  const loadGuide = async () => {
    try {
      const response = await guides.get(id);
      const guideData = response.data.data?.guide || response.data.guide || response.data;
      if (!user || (user.id !== guideData.author_id && user.role !== 'admin')) {
        alert('Ви не можете редагувати цей гайд');
        navigate(`/guides/${id}`);
        return;
      }
      setTitle(guideData.title);
      setSummary(guideData.summary || '');
      setBody(guideData.body || '');
      setDifficulty(guideData.difficulty || 'beginner');
      setEstimatedMinutes(guideData.estimated_minutes || 15);
      setTagsInput(Array.isArray(guideData.tags) ? guideData.tags.join(', ') : '');
    } catch (error) {
      console.error('Помилка завантаження гайду:', error);
      alert('Помилка завантаження гайду');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = 'Заголовок обов\'язковий';
    if (!summary.trim() || summary.length < 20) newErrors.summary = 'Опис має бути мінімум 20 символів';
    if (!body.trim() || body.length < 80) newErrors.body = 'Тіло гайду має бути мінімум 80 символів';
    if (!estimatedMinutes || Number(estimatedMinutes) < 1) newErrors.estimatedMinutes = 'Вкажіть орієнтовний час';
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length === 0) newErrors.tags = 'Додайте хоча б один тег';
    else if (tags.length > 8) newErrors.tags = 'Максимум 8 тегів';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const tags = tagsInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      await guides.update(id, {
        title: title.trim(),
        summary: summary.trim(),
        body: body.trim(),
        difficulty,
        estimatedMinutes: Number(estimatedMinutes),
        tags,
      });
      navigate(`/guides/${id}`);
    } catch (error) {
      console.error('Помилка оновлення гайду:', error);
      if (error.response?.data?.errors) {
        const apiErrors = {};
        error.response.data.errors.forEach((err) => {
          apiErrors[err.field] = err.message;
        });
        setErrors(apiErrors);
      } else {
        alert(error.response?.data?.message || 'Помилка оновлення гайду');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return <div className="container"><div className="empty-state"><h2>УВІЙДІТЬ, ЩОБ РЕДАГУВАТИ ГАЙД</h2><button onClick={() => navigate('/login')} className="btn btn-primary">УВІЙТИ</button></div></div>;
  if (loading) return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;

  return (
    <div className="container">
      <div className="page-header"><h1 className="page-title">РЕДАГУВАТИ ГАЙД</h1></div>
      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-group">
          <label htmlFor="title" className="form-label">ЗАГОЛОВОК</label>
          <input id="title" className={`form-input ${errors.title ? 'error' : ''}`} value={title} onChange={(e) => setTitle(e.target.value)} />
          {errors.title && <div className="form-error">{errors.title}</div>}
        </div>
        <div className="form-group">
          <label htmlFor="summary" className="form-label">КОРОТКИЙ ОПИС</label>
          <textarea id="summary" className={`form-textarea ${errors.summary ? 'error' : ''}`} value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
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
          <input id="tags" className={`form-input ${errors.tags ? 'error' : ''}`} value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          {errors.tags && <div className="form-error">{errors.tags}</div>}
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'ЗБЕРЕЖЕННЯ...' : 'ЗБЕРЕГТИ ЗМІНИ'}</button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/guides/${id}`)} disabled={submitting}>СКАСУВАТИ</button>
        </div>
      </form>
    </div>
  );
}

export default EditGuide;
