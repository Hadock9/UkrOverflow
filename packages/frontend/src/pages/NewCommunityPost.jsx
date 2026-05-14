/**
 * Універсальна форма створення поста у спільноті.
 * Тип визначається з ?type=... query (за замовч. discussion).
 */

import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { communities, communityPosts } from '../services/api';
import { parseHubMaterialUrl } from '../utils/hubLinkParse';
import '../styles/brutalism.css';

const TYPES = [
  { value: 'discussion', label: 'Обговорення' },
  { value: 'pet_project', label: 'Пет-проєкт' },
  { value: 'code_review', label: 'Перегляд коду' },
  { value: 'mentor_request', label: 'Шукаю ментора' },
  { value: 'roadmap_request', label: 'Шукаю навчальний маршрут' },
  { value: 'team_search', label: 'Шукаю команду' },
  { value: 'event', label: 'Подія' },
  { value: 'announcement', label: 'Анонс' },
];

const LEVELS = [
  { value: 'beginner', label: 'Початківець' },
  { value: 'junior', label: 'Джун' },
  { value: 'middle', label: 'Мідл' },
  { value: 'senior', label: 'Сеньйор' },
];

const PROJECT_STAGES = [
  { value: 'idea', label: 'Ідея' },
  { value: 'mvp', label: 'MVP' },
  { value: 'production', label: 'Продакшн' },
];

function ChipsInput({ value, onChange, placeholder, max = 20 }) {
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

export function NewCommunityPost() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const initialType = searchParams.get('type') || 'discussion';
  const [type, setType] = useState(TYPES.find((t) => t.value === initialType) ? initialType : 'discussion');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [stack, setStack] = useState([]);

  // pet_project
  const [roles, setRoles] = useState([]);
  const [commitmentHours, setCommitmentHours] = useState(4);
  const [projectStage, setProjectStage] = useState('idea');

  // code_review
  const [repoUrl, setRepoUrl] = useState('');
  const [prUrl, setPrUrl] = useState('');
  const [focusAreas, setFocusAreas] = useState([]);

  // mentor_request
  const [topic, setTopic] = useState('');
  const [currentLevel, setCurrentLevel] = useState('junior');
  const [goal, setGoal] = useState('');

  // roadmap_request
  const [currentSkills, setCurrentSkills] = useState([]);
  const [timelineMonths, setTimelineMonths] = useState(3);

  // event
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLink, setEventLink] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [hubLinkInput, setHubLinkInput] = useState('');

  const { data: community } = useQuery({
    queryKey: ['community-for-post', slug],
    queryFn: async () => (await communities.get(slug)).data.data.community,
    enabled: !!slug,
  });

  if (!user) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>УВІЙДІТЬ, ЩОБ СТВОРИТИ ПОСТ</h2>
          <button onClick={() => navigate('/login')} className="btn btn-primary">УВІЙТИ</button>
        </div>
      </div>
    );
  }

  const validate = () => {
    const e = {};
    if (!title.trim() || title.trim().length < 5) e.title = 'Заголовок мінімум 5 символів';
    if (title.length > 255) e.title = 'Заголовок максимум 255 символів';
    if (!body.trim() || body.trim().length < 20) e.body = 'Тіло мінімум 20 символів';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildMetadata = () => {
    switch (type) {
      case 'pet_project':
        return { roles, commitmentHoursWeek: Number(commitmentHours) || 0, projectStage };
      case 'code_review':
        return { repoUrl: repoUrl.trim(), prUrl: prUrl.trim(), focusAreas };
      case 'mentor_request':
        return { topic: topic.trim(), currentLevel, goal: goal.trim() };
      case 'roadmap_request':
        return { goal: goal.trim(), currentSkills, timelineMonths: Number(timelineMonths) || 0 };
      case 'team_search':
        return { roles };
      case 'event':
        return {
          location: eventLocation.trim() || null,
          eventDate: eventDate || null,
          eventLink: eventLink.trim() || null,
        };
      default:
        return {};
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!community) return;
    if (!validate()) return;
    setSubmitting(true);
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
      const { linkedContentType, linkedContentId } = parseHubMaterialUrl(hubLinkInput, base);
      const r = await communityPosts.create({
        communityId: community.id,
        type,
        title: title.trim(),
        body: body.trim(),
        metadata: buildMetadata(),
        stack,
        linkedContentType,
        linkedContentId,
      });
      const post = r.data.data?.post || r.data.post;
      navigate(`/community-posts/${post.id}`);
    } catch (err) {
      console.error(err);
      if (err.response?.data?.errors) {
        const ae = {};
        err.response.data.errors.forEach((x) => { ae[x.field] = x.message; });
        setErrors(ae);
      } else {
        alert(err.response?.data?.message || 'Помилка створення поста');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">НОВИЙ ПОСТ {community ? `· ${community.name}` : ''}</h1>
        <p className="page-subtitle">Тип визначає, які додаткові поля показати.</p>
      </div>

      <form onSubmit={onSubmit} className="question-form">
        <div className="form-group">
          <label className="form-label">ТИП</label>
          <select className="form-input" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">ЗАГОЛОВОК</label>
          <input
            type="text"
            className={`form-input ${errors.title ? 'error' : ''}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Короткий опис того, що шукаєте/пропонуєте"
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
            placeholder="Деталі, контекст, очікування. Підтримується Маркдаун."
          />
          {errors.body && <div className="form-error">{errors.body}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">СТЕК / ТЕГИ</label>
          <ChipsInput value={stack} onChange={setStack} placeholder="react, typescript, postgresql" max={15} />
        </div>

        <div className="form-group">
          <label className="form-label">ПОСИЛАННЯ НА МАТЕРІАЛ ХАБУ (ОПЦІЙНО)</label>
          <input
            type="text"
            className="form-input"
            value={hubLinkInput}
            onChange={(e) => setHubLinkInput(e.target.value)}
            placeholder="Напр. /snippets/12 або повний URL до питання, сніпета, маршруту, ЧаП…"
          />
          <div className="form-hint" style={{ fontSize: 12, marginTop: 4 }}>
            Використовується для перехресного зв’язку з базою знань. Лишіть порожнім, якщо не потрібно.
          </div>
        </div>

        {type === 'pet_project' && (
          <>
            <div className="form-group">
              <label className="form-label">РОЛІ, ЯКІ ШУКАЄТЕ</label>
              <ChipsInput value={roles} onChange={setRoles} placeholder="Фронтенд, бекенд, дизайн" max={10} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
              <div className="form-group">
                <label className="form-label">ГОДИН / ТИЖДЕНЬ</label>
                <input type="number" min="1" max="60" className="form-input" value={commitmentHours} onChange={(e) => setCommitmentHours(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">СТАДІЯ ПРОЄКТУ</label>
                <select className="form-input" value={projectStage} onChange={(e) => setProjectStage(e.target.value)}>
                  {PROJECT_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        {type === 'code_review' && (
          <>
            <div className="form-group">
              <label className="form-label">URL РЕПОЗИТОРІЮ</label>
              <input type="url" className="form-input" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/..." />
            </div>
            <div className="form-group">
              <label className="form-label">URL ЗАПИТУ НА ЗЛИТТЯ</label>
              <input type="url" className="form-input" value={prUrl} onChange={(e) => setPrUrl(e.target.value)} placeholder="https://github.com/.../pull/123" />
            </div>
            <div className="form-group">
              <label className="form-label">ФОКУС РЕВ'Ю</label>
              <ChipsInput value={focusAreas} onChange={setFocusAreas} placeholder="читабельність, швидкодія, безпека" max={10} />
            </div>
          </>
        )}

        {type === 'mentor_request' && (
          <>
            <div className="form-group">
              <label className="form-label">ТЕМА</label>
              <input type="text" className="form-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Продуктивність React, системний дизайн..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
              <div className="form-group">
                <label className="form-label">ВАШ РІВЕНЬ</label>
                <select className="form-input" value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value)}>
                  {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">МЕТА</label>
                <input type="text" className="form-input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Дійти до рівня мідл за 3 місяці" />
              </div>
            </div>
          </>
        )}

        {type === 'roadmap_request' && (
          <>
            <div className="form-group">
              <label className="form-label">МЕТА</label>
              <input type="text" className="form-input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Стати фулстеком за 6 місяців" />
            </div>
            <div className="form-group">
              <label className="form-label">ПОТОЧНІ ВМІННЯ</label>
              <ChipsInput value={currentSkills} onChange={setCurrentSkills} placeholder="JavaScript, HTML, CSS" max={15} />
            </div>
            <div className="form-group">
              <label className="form-label">ТЕРМІН (МІСЯЦІВ)</label>
              <input type="number" min="1" max="36" className="form-input" value={timelineMonths} onChange={(e) => setTimelineMonths(e.target.value)} />
            </div>
          </>
        )}

        {type === 'team_search' && (
          <div className="form-group">
            <label className="form-label">РОЛІ</label>
            <ChipsInput value={roles} onChange={setRoles} placeholder="Фронтенд, бекенд, продукт" max={10} />
          </div>
        )}

        {type === 'event' && (
          <>
            <div className="form-group">
              <label className="form-label">МІСЦЕ</label>
              <input type="text" className="form-input" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Київ, простір DevFlow" />
            </div>
            <div className="form-group">
              <label className="form-label">ДАТА І ЧАС</label>
              <input type="datetime-local" className="form-input" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">ПОСИЛАННЯ</label>
              <input type="url" className="form-input" value={eventLink} onChange={(e) => setEventLink(e.target.value)} placeholder="https://..." />
            </div>
          </>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'ПУБЛІКАЦІЯ...' : 'ОПУБЛІКУВАТИ'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/communities/${slug}`)} disabled={submitting}>
            СКАСУВАТИ
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewCommunityPost;
