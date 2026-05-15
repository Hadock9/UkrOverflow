/**
 * Сторінка створення нової спільноти.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { communities } from '../services/api';
import '../styles/brutalism.css';

const TYPES = [
  { value: 'city', label: 'Місто (локальна офлайн-спільнота)' },
  { value: 'university', label: 'Університет' },
  { value: 'dev_club', label: 'Dev Club' },
  { value: 'project_team', label: 'Команда проєкту' },
  { value: 'study_group', label: 'Навчальна група' },
  { value: 'company', label: 'Компанія' },
  { value: 'online', label: 'Онлайн' },
];

export function NewCommunity() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [type, setType] = useState('dev_club');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  if (!user) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>УВІЙДІТЬ, ЩОБ СТВОРИТИ СПІЛЬНОТУ</h2>
          <button onClick={() => navigate('/login')} className="btn btn-primary">УВІЙТИ</button>
        </div>
      </div>
    );
  }

  const addTag = () => {
    const v = tagInput.trim().toLowerCase();
    if (!v) return;
    if (tags.includes(v)) { setTagInput(''); return; }
    if (tags.length >= 10) return;
    setTags([...tags, v]);
    setTagInput('');
  };
  const removeTag = (t) => setTags(tags.filter((x) => x !== t));
  const handleTagKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = 'Назва обов\'язкова';
    else if (name.trim().length < 3) e.name = 'Мінімум 3 символи';
    else if (name.trim().length > 160) e.name = 'Максимум 160 символів';
    if (description.length > 2000) e.description = 'Максимум 2000 символів';
    if (tags.length > 10) e.tags = 'Максимум 10 тегів';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const r = await communities.create({
        name: name.trim(),
        type,
        description: description.trim() || null,
        location: location.trim() || null,
        website: website.trim() || null,
        tags,
      });
      const community = r.data.data?.community || r.data.community;
      navigate(`/communities/${community.slug}`);
    } catch (err) {
      console.error(err);
      if (err.response?.data?.errors) {
        const apiErrors = {};
        err.response.data.errors.forEach((x) => { apiErrors[x.field] = x.message; });
        setErrors(apiErrors);
      } else {
        alert(err.response?.data?.message || 'Помилка створення спільноти');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">НОВА СПІЛЬНОТА</h1>
        <p className="page-subtitle">
          Локальна, університетська, онлайн або команда під проєкт — простір для розробників, які тримаються разом.
        </p>
      </div>

      <form onSubmit={onSubmit} className="question-form">
        <div className="form-group">
          <label className="form-label">НАЗВА</label>
          <input
            type="text"
            className={`form-input ${errors.name ? 'error' : ''}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="DevFlow Львів"
            maxLength={160}
          />
          {errors.name && <div className="form-error">{errors.name}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
          <div className="form-group">
            <label className="form-label">ТИП</label>
            <select className="form-input" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">ЛОКАЦІЯ</label>
            <input
              type="text"
              className="form-input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Львів"
              maxLength={120}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">САЙТ</label>
          <input
            type="url"
            className="form-input"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://devflow.ua"
            maxLength={255}
          />
        </div>

        <div className="form-group">
          <label className="form-label">ОПИС</label>
          <textarea
            className={`form-textarea ${errors.description ? 'error' : ''}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            maxLength={2000}
            placeholder="Хто ваша аудиторія, що ви робите, як приєднатися"
          />
          {errors.description && <div className="form-error">{errors.description}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">ТЕГИ</label>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input
              type="text"
              className={`form-input ${errors.tags ? 'error' : ''}`}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKey}
              placeholder="фронтенд, міт-ап, львів"
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-secondary" onClick={addTag} disabled={!tagInput.trim() || tags.length >= 10}>
              + ТЕГ
            </button>
          </div>
          {tags.length > 0 && (
            <div className="question-tags" style={{ marginTop: 'var(--space-2)' }}>
              {tags.map((t) => (
                <span key={t} className="tag tag-removable">
                  {t}
                  <button
                    type="button"
                    className="tag-remove"
                    onClick={() => removeTag(t)}
                    aria-label={`Видалити ${t}`}
                  >×</button>
                </span>
              ))}
            </div>
          )}
          {errors.tags && <div className="form-error">{errors.tags}</div>}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'СТВОРЕННЯ...' : 'СТВОРИТИ СПІЛЬНОТУ'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/communities')} disabled={submitting}>
            СКАСУВАТИ
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewCommunity;
