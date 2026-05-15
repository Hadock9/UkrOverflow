/**
 * Редагування поста спільноти (title, body, stack).
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { communityPosts } from '../services/api';
import '../styles/brutalism.css';

function ChipsInput({ value, onChange, placeholder, max = 15 }) {
  const [text, setText] = useState('');
  const add = () => {
    const v = text.trim();
    if (!v) return;
    if (value.includes(v)) { setText(''); return; }
    if (value.length >= max) return;
    onChange([...value, v]);
    setText('');
  };
  const remove = (t) => onChange(value.filter((x) => x !== t));
  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          className="form-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          style={{ flex: 1 }}
        />
        <button type="button" className="btn btn-secondary" onClick={add} disabled={!text.trim() || value.length >= max}>
          +
        </button>
      </div>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {value.map((t) => (
            <span key={t} className="tag tag-removable">
              {t}
              <button type="button" className="tag-remove" onClick={() => remove(t)} aria-label={`Видалити ${t}`}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function EditCommunityPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [stack, setStack] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadPost();
  }, [id]);

  const loadPost = async () => {
    try {
      const response = await communityPosts.get(id);
      const post = response.data.data?.post || response.data.post || response.data;
      if (!user || (user.id !== post.author_id && user.role !== 'admin')) {
        alert('Ви не можете редагувати цей пост');
        navigate(`/community-posts/${id}`);
        return;
      }
      setTitle(post.title || '');
      setBody(post.body || '');
      setStack(Array.isArray(post.stack) ? post.stack : []);
    } catch (error) {
      console.error(error);
      alert('Помилка завантаження');
      navigate('/communities');
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const e = {};
    if (!title.trim() || title.trim().length < 5) e.title = 'Заголовок мінімум 5 символів';
    if (title.length > 255) e.title = 'Заголовок максимум 255 символів';
    if (!body.trim() || body.trim().length < 20) e.body = 'Тіло мінімум 20 символів';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await communityPosts.update(id, {
        title: title.trim(),
        body: body.trim(),
        stack,
      });
      navigate(`/community-posts/${id}`);
    } catch (err) {
      console.error(err);
      if (err.response?.data?.errors) {
        const ae = {};
        err.response.data.errors.forEach((x) => { ae[x.field] = x.message; });
        setErrors(ae);
      } else {
        alert(err.response?.data?.message || 'Помилка збереження');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>УВІЙДІТЬ, ЩОБ РЕДАГУВАТИ ПОСТ</h2>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>УВІЙТИ</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">РЕДАГУВАТИ ПОСТ СПІЛЬНОТИ</h1>
        <p className="page-subtitle">Метадані типу поста збережуться без змін.</p>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-group">
          <label className="form-label">ЗАГОЛОВОК</label>
          <input
            type="text"
            className={`form-input ${errors.title ? 'error' : ''}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
          />
          {errors.title && <div className="form-error">{errors.title}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">ТЕКСТ (Маркдаун)</label>
          <textarea
            className={`form-textarea ${errors.body ? 'error' : ''}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
          />
          {errors.body && <div className="form-error">{errors.body}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">СТЕК / ТЕГИ</label>
          <ChipsInput value={stack} onChange={setStack} placeholder="react, typescript, postgresql" max={15} />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'ЗБЕРЕЖЕННЯ...' : 'ЗБЕРЕГТИ'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/community-posts/${id}`)} disabled={submitting}>
            СКАСУВАТИ
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditCommunityPost;
