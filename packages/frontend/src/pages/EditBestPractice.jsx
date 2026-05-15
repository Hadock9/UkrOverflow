/**
 * Редагування найкращої практики.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { bestPractices } from '../services/api';
import { MarkdownEditor } from '../components/MarkdownEditor';
import '../styles/brutalism.css';

export function EditBestPractice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [rule, setRule] = useState('');
  const [body, setBody] = useState('');
  const [antiPatterns, setAntiPatterns] = useState('');
  const [category, setCategory] = useState('');
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
      const response = await bestPractices.get(id);
      const item = response.data.data?.bestPractice || response.data.bestPractice || response.data;
      if (!user || (user.id !== item.author_id && user.role !== 'admin')) {
        alert('Ви не можете редагувати цю найкращу практику');
        navigate(`/best-practices/${id}`);
        return;
      }
      setTitle(item.title || '');
      setRule(item.rule || '');
      setBody(item.body || '');
      setAntiPatterns(item.anti_patterns || item.antiPatterns || '');
      setCategory(item.category || '');
      setTags(Array.isArray(item.tags) ? item.tags : []);
    } catch (error) {
      console.error(error);
      alert('Помилка завантаження');
      navigate('/best-practices');
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

  const validate = () => {
    const next = {};
    if (!title.trim()) next.title = 'Заголовок обов\'язковий';
    if (!rule.trim()) next.rule = 'Правило обов\'язкове';
    if (!body.trim() || body.length < 80) next.body = 'Опис мінімум 80 символів';
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
        rule: rule.trim(),
        body: body.trim(),
        tags,
      };
      if (antiPatterns.trim()) payload.antiPatterns = antiPatterns.trim();
      if (category.trim()) payload.category = category.trim();
      await bestPractices.update(id, payload);
      navigate(`/best-practices/${id}`);
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
          <h2>УВІЙДІТЬ, ЩОБ РЕДАГУВАТИ</h2>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>УВІЙТИ</button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">РЕДАГУВАТИ НАЙКРАЩУ ПРАКТИКУ</h1>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-group">
          <label htmlFor="title" className="form-label">ЗАГОЛОВОК</label>
          <input id="title" className={`form-input ${errors.title ? 'error' : ''}`} value={title} onChange={(e) => setTitle(e.target.value)} />
          {errors.title && <div className="form-error">{errors.title}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="rule" className="form-label">ПРАВИЛО</label>
          <textarea id="rule" className={`form-textarea ${errors.rule ? 'error' : ''}`} value={rule} onChange={(e) => setRule(e.target.value)} rows={3} />
          {errors.rule && <div className="form-error">{errors.rule}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="category" className="form-label">КАТЕГОРІЯ</label>
          <input id="category" className="form-input" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">ОПИС</label>
          <MarkdownEditor value={body} onChange={setBody} showPreview />
          {errors.body && <div className="form-error">{errors.body}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="antiPatterns" className="form-label">АНТИПАТЕРНИ</label>
          <textarea id="antiPatterns" className="form-textarea" value={antiPatterns} onChange={(e) => setAntiPatterns(e.target.value)} rows={5} />
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
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/best-practices/${id}`)} disabled={submitting}>СКАСУВАТИ</button>
        </div>
      </form>
    </div>
  );
}

export default EditBestPractice;
