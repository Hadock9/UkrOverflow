/**
 * Редагування ЧаП.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { faqs } from '../services/api';
import { MarkdownEditor } from '../components/MarkdownEditor';
import '../styles/brutalism.css';

export function EditFaq() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [body, setBody] = useState('');
  const [qaPairs, setQaPairs] = useState([{ question: '', answer: '' }]);
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
      const response = await faqs.get(id);
      const item = response.data.data?.faq || response.data.faq || response.data;
      if (!user || (user.id !== item.author_id && user.role !== 'admin')) {
        alert('Ви не можете редагувати цей ЧаП');
        navigate(`/faqs/${id}`);
        return;
      }
      setTitle(item.title || '');
      setTopic(item.topic || '');
      setBody(item.body || '');
      const pairs = item.qa_pairs || item.qaPairs;
      if (Array.isArray(pairs) && pairs.length > 0) {
        setQaPairs(pairs.map((p) => ({ question: p.question || '', answer: p.answer || '' })));
      }
      setTags(Array.isArray(item.tags) ? item.tags : []);
    } catch (error) {
      console.error(error);
      alert('Помилка завантаження');
      navigate('/faqs');
    } finally {
      setLoading(false);
    }
  };

  const updatePair = (index, field, value) => {
    setQaPairs((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const addPair = () => setQaPairs((prev) => [...prev, { question: '', answer: '' }]);
  const removePair = (index) => {
    setQaPairs((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
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
    if (!topic.trim()) next.topic = 'Тема обов\'язкова';
    if (!body.trim() || body.length < 80) next.body = 'Опис мінімум 80 символів';
    const badIdx = qaPairs.findIndex((p) => !p.question.trim() || !p.answer.trim());
    if (badIdx >= 0) next.qaPairs = `Заповніть пару ${badIdx + 1}`;
    if (tags.length === 0) next.tags = 'Додайте хоча б один тег';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await faqs.update(id, {
        title: title.trim(),
        topic: topic.trim(),
        body: body.trim(),
        qaPairs: qaPairs.map((p) => ({ question: p.question.trim(), answer: p.answer.trim() })),
        tags,
      });
      navigate(`/faqs/${id}`);
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
          <h2>УВІЙДІТЬ, ЩОБ РЕДАГУВАТИ ЧаП</h2>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>УВІЙТИ</button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">РЕДАГУВАТИ ЧаП</h1>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-group">
          <label htmlFor="title" className="form-label">ЗАГОЛОВОК</label>
          <input id="title" className={`form-input ${errors.title ? 'error' : ''}`} value={title} onChange={(e) => setTitle(e.target.value)} />
          {errors.title && <div className="form-error">{errors.title}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="topic" className="form-label">ТЕМА</label>
          <input id="topic" className={`form-input ${errors.topic ? 'error' : ''}`} value={topic} onChange={(e) => setTopic(e.target.value)} />
          {errors.topic && <div className="form-error">{errors.topic}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">ВСТУПНИЙ ОПИС</label>
          <MarkdownEditor value={body} onChange={setBody} showPreview />
          {errors.body && <div className="form-error">{errors.body}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">ПИТАННЯ ТА ВІДПОВІДІ</label>
          {qaPairs.map((pair, index) => (
            <div key={index} style={{ border: '3px solid #000', padding: 12, marginBottom: 12, boxShadow: '4px 4px 0 #000' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong>ПАРА #{index + 1}</strong>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => removePair(index)} disabled={qaPairs.length <= 1}>ВИДАЛИТИ</button>
              </div>
              <input className="form-input" value={pair.question} onChange={(e) => updatePair(index, 'question', e.target.value)} placeholder="Питання" style={{ marginBottom: 8 }} />
              <textarea className="form-textarea" rows={4} value={pair.answer} onChange={(e) => updatePair(index, 'answer', e.target.value)} placeholder="Відповідь" />
            </div>
          ))}
          {errors.qaPairs && <div className="form-error">{errors.qaPairs}</div>}
          <button type="button" className="btn btn-secondary" onClick={addPair} style={{ marginTop: 8 }}>+ ДОДАТИ ПАРУ</button>
        </div>

        <div className="form-group">
          <label className="form-label">ТЕГИ</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className={`form-input ${errors.tags ? 'error' : ''}`} value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} style={{ flex: 1 }} />
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
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/faqs/${id}`)} disabled={submitting}>СКАСУВАТИ</button>
        </div>
      </form>
    </div>
  );
}

export default EditFaq;
