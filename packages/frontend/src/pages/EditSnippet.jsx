/**
 * Сторінка редагування snippet.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { snippets } from '../services/api';
import '../styles/brutalism.css';

const LANGUAGES = ['javascript', 'typescript', 'python', 'php', 'sql', 'html', 'css', 'bash', 'json', 'other'];

export function EditSnippet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadSnippet();
  }, [id]);

  const loadSnippet = async () => {
    try {
      const response = await snippets.get(id);
      const snippetData = response.data.data?.snippet || response.data.snippet || response.data;

      if (!user || (user.id !== snippetData.author_id && user.role !== 'admin')) {
        alert('Ви не можете редагувати цей snippet');
        navigate(`/snippets/${id}`);
        return;
      }

      setTitle(snippetData.title);
      setDescription(snippetData.description || '');
      setCode(snippetData.code || '');
      setLanguage(snippetData.language || 'javascript');
      setTagsInput(Array.isArray(snippetData.tags) ? snippetData.tags.join(', ') : '');
    } catch (error) {
      console.error('Помилка завантаження snippet:', error);
      alert('Помилка завантаження snippet');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = 'Заголовок обов\'язковий';
    if (!description.trim() || description.length < 20) newErrors.description = 'Пояснення має бути мінімум 20 символів';
    if (!code.trim() || code.length < 3) newErrors.code = 'Код має бути мінімум 3 символи';
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
      await snippets.update(id, {
        title: title.trim(),
        description: description.trim(),
        code: code.trim(),
        language,
        tags,
      });
      navigate(`/snippets/${id}`);
    } catch (error) {
      console.error('Помилка оновлення snippet:', error);
      if (error.response?.data?.errors) {
        const apiErrors = {};
        error.response.data.errors.forEach((err) => {
          apiErrors[err.field] = err.message;
        });
        setErrors(apiErrors);
      } else {
        alert(error.response?.data?.message || 'Помилка оновлення snippet');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container"><div className="empty-state"><h2>УВІЙДІТЬ, ЩОБ РЕДАГУВАТИ SNIPPET</h2><button onClick={() => navigate('/login')} className="btn btn-primary">УВІЙТИ</button></div></div>
    );
  }

  if (loading) return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">РЕДАГУВАТИ SNIPPET</h1>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-group">
          <label htmlFor="title" className="form-label">ЗАГОЛОВОК</label>
          <input id="title" className={`form-input ${errors.title ? 'error' : ''}`} value={title} onChange={(e) => setTitle(e.target.value)} />
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
          <textarea id="description" className={`form-textarea ${errors.description ? 'error' : ''}`} value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
          {errors.description && <div className="form-error">{errors.description}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="code" className="form-label">КОД</label>
          <textarea id="code" className={`form-textarea ${errors.code ? 'error' : ''}`} value={code} onChange={(e) => setCode(e.target.value)} rows={14} style={{ fontFamily: 'var(--font-mono)' }} />
          {errors.code && <div className="form-error">{errors.code}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="tags" className="form-label">ТЕГИ</label>
          <input id="tags" className={`form-input ${errors.tags ? 'error' : ''}`} value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          {errors.tags && <div className="form-error">{errors.tags}</div>}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'ЗБЕРЕЖЕННЯ...' : 'ЗБЕРЕГТИ ЗМІНИ'}</button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/snippets/${id}`)} disabled={submitting}>СКАСУВАТИ</button>
        </div>
      </form>
    </div>
  );
}

export default EditSnippet;
