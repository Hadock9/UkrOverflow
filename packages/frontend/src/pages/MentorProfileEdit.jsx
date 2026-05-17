/**
 * Сторінка редагування менторського профілю.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { mentors } from '../services/api';
import '../styles/brutalism.css';

const TOP_TECH = [
  'react', 'typescript', 'javascript', 'nodejs', 'python', 'go', 'java', 'rust',
  'kubernetes', 'docker', 'postgresql', 'mongodb', 'aws', 'gcp', 'graphql', 'nextjs',
];

const HOURS_WEEK_MAX = 40;

/** Лише цілі 0–40 (без e/E/+/- як у type="number"). */
function parseHoursPerWeekInput(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return 0;
  return Math.min(HOURS_WEEK_MAX, parseInt(digits, 10));
}

function ChipsInput({ value, onChange, placeholder, suggestions, max = 10 }) {
  const [text, setText] = useState('');
  const add = (raw) => {
    const v = String(raw || '').trim().toLowerCase();
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
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text); } }}
          placeholder={placeholder}
          style={{ flex: 1 }}
        />
        <button type="button" className="btn btn-secondary" onClick={() => add(text)} disabled={!text.trim() || value.length >= max}>+</button>
      </div>
      {suggestions && suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {suggestions.filter((s) => !value.includes(s)).slice(0, 12).map((s) => (
            <button key={s} type="button" className="filter-btn" onClick={() => add(s)} style={{ fontSize: 12 }}>
              + {s}
            </button>
          ))}
        </div>
      )}
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {value.map((t) => (
            <span key={t} className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {t}
              <button type="button" onClick={() => remove(t)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function MentorProfileEdit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['mentors-me'],
    queryFn: async () => (await mentors.me()).data.data.profile,
    enabled: !!user,
  });

  const [bio, setBio] = useState('');
  const [stack, setStack] = useState([]);
  const [topics, setTopics] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [availability, setAvailability] = useState(0);
  const [priceNote, setPriceNote] = useState('');
  const [contact, setContact] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!profile) return;
    queueMicrotask(() => {
      setBio(profile.bio || '');
      setStack(Array.isArray(profile.stack) ? profile.stack : []);
      setTopics(Array.isArray(profile.topics) ? profile.topics : []);
      setLanguages(Array.isArray(profile.languages) ? profile.languages : []);
      setAvailability(profile.availability_hours_week || 0);
      setPriceNote(profile.price_note || '');
      setContact(profile.contact_method || '');
      setIsActive(!!profile.is_active);
    });
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: (payload) => mentors.upsertMe(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mentors-me'] });
      qc.invalidateQueries({ queryKey: ['mentors-list'] });
      navigate('/mentors');
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => mentors.deleteMe(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mentors-me'] });
      qc.invalidateQueries({ queryKey: ['mentors-list'] });
      navigate('/mentors');
    },
  });

  if (!user) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>УВІЙДІТЬ, ЩОБ НАЛАШТУВАТИ ПРОФІЛЬ МЕНТОРА</h2>
          <button onClick={() => navigate('/login')} className="btn btn-primary">УВІЙТИ</button>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;

  const validate = () => {
    const e = {};
    if (!bio.trim() || bio.trim().length < 20) e.bio = 'Bio мінімум 20 символів';
    if (bio.length > 2000) e.bio = 'Bio максимум 2000 символів';
    if (stack.length < 1) e.stack = 'Додайте мінімум 1 елемент стеку';
    if (stack.length > 10) e.stack = 'Максимум 10';
    const hours = Number(availability);
    if (!Number.isFinite(hours) || hours < 0 || hours > HOURS_WEEK_MAX) {
      e.availability = `Вкажіть ціле число від 0 до ${HOURS_WEEK_MAX}`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    saveMutation.mutate({
      bio: bio.trim(),
      stack,
      topics,
      languages,
      availabilityHoursWeek: Number(availability) || 0,
      priceNote: priceNote.trim() || null,
      contactMethod: contact.trim() || null,
      isActive,
    });
  };

  const onDelete = () => {
    if (confirm('Видалити менторський профіль?')) deleteMutation.mutate();
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">{profile ? 'ПРОФІЛЬ МЕНТОРА' : 'СТАТИ МЕНТОРОМ'}</h1>
        <p className="page-subtitle">Розкажіть про свій досвід — це допоможе іншим знайти потрібну допомогу.</p>
      </div>

      <form onSubmit={onSubmit} className="question-form">
        <div className="form-group">
          <label className="form-label">ПРО СЕБЕ</label>
          <textarea
            className={`form-textarea ${errors.bio ? 'error' : ''}`}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={6}
            maxLength={2000}
            placeholder="Хто ви, скільки років у професії, який досвід, що цікавить у менторстві"
          />
          {errors.bio && <div className="form-error">{errors.bio}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">СТЕК (мінімум 1, максимум 10)</label>
          <ChipsInput value={stack} onChange={setStack} placeholder="react, typescript" suggestions={TOP_TECH} max={10} />
          {errors.stack && <div className="form-error">{errors.stack}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">ТЕМИ</label>
          <ChipsInput value={topics} onChange={setTopics} placeholder="архітектура, продуктивність, кар'єра" max={10} />
        </div>

        <div className="form-group">
          <label className="form-label">МОВИ</label>
          <ChipsInput value={languages} onChange={setLanguages} placeholder="ua, en" max={5} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
          <div className="form-group">
            <label className="form-label">ГОДИН / ТИЖДЕНЬ</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={`form-input ${errors.availability ? 'error' : ''}`}
              value={availability === 0 ? '' : String(availability)}
              onChange={(e) => setAvailability(parseHoursPerWeekInput(e.target.value))}
              onKeyDown={(e) => {
                if (['e', 'E', '+', '-', '.', ','].includes(e.key)) e.preventDefault();
              }}
              placeholder="0–40"
              maxLength={2}
            />
            {errors.availability && <div className="form-error">{errors.availability}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">УМОВИ / ОПЛАТА</label>
            <input
              type="text"
              className="form-input"
              value={priceNote}
              onChange={(e) => setPriceNote(e.target.value)}
              placeholder="Безкоштовно / донат / 30 USD на год"
              maxLength={160}
            />
          </div>
          <div className="form-group">
            <label className="form-label">ЯК ЗВ'ЯЗАТИСЯ</label>
            <input
              type="text"
              className="form-input"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Telegram @нік"
              maxLength={160}
            />
          </div>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)' }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            АКТИВНИЙ (показувати у каталозі)
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'ЗБЕРЕЖЕННЯ...' : 'ЗБЕРЕГТИ'}
          </button>
          {profile && (
            <button type="button" className="btn btn-secondary" onClick={onDelete} disabled={deleteMutation.isPending}>
              ВИДАЛИТИ ПРОФІЛЬ
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default MentorProfileEdit;
