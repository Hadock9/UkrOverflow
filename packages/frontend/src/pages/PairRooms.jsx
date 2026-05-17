/**
 * Кімнати парного програмування.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { pairRooms } from '../services/api';
import '../styles/brutalism.css';
import './SocialPages.css';

const TOPIC_FILTERS = [
  { id: '', label: 'ВСІ' },
  { id: 'debug this', label: 'DEBUG THIS' },
  { id: 'study JS', label: 'STUDY JS' },
  { id: 'react', label: 'REACT' },
  { id: 'algorithms', label: 'АЛГОРИТМИ' },
];

export function PairRooms() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: '',
    topic: 'debug this',
    roomType: 'debug',
    description: '',
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['pair-rooms', topic],
    queryFn: async () => {
      const params = { limit: 50 };
      if (topic) params.topic = topic;
      const r = await pairRooms.list(params);
      return r.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload) => pairRooms.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pair-rooms'] });
      setShowCreate(false);
      setForm({ title: '', topic: 'debug this', roomType: 'debug', description: '' });
    },
  });

  const list = data?.rooms || [];

  const handleCreate = (e) => {
    e.preventDefault();
    if (!isAuthenticated) return;
    createMutation.mutate(form);
  };

  return (
    <div className="container">
      <div className="page-header page-header-split">
        <div>
          <h1 className="page-title">КОЛАБОРАЦІЯ</h1>
          <p className="page-subtitle">
            Кімнати для спільного дебагу, навчання JS та live coding з чатом і редактором коду.
          </p>
        </div>
        {isAuthenticated && (
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
            + НОВА КІМНАТА
          </button>
        )}
      </div>

      {showCreate && isAuthenticated && (
        <form className="question-card" style={{ marginBottom: 'var(--space-4)' }} onSubmit={handleCreate}>
          <h3>Створити кімнату</h3>
          <input
            className="input"
            placeholder="Назва кімнати"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            minLength={3}
          />
          <select
            className="input"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
          >
            <option value="debug this">debug this</option>
            <option value="study JS">study JS</option>
            <option value="study Python">study Python</option>
            <option value="react">react</option>
            <option value="algorithms">algorithms</option>
            <option value="general">general</option>
          </select>
          <textarea
            className="input"
            placeholder="Опис (необовʼязково)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
          />
          <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
            СТВОРИТИ
          </button>
        </form>
      )}

      <div className="filters" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 'var(--space-3)' }}>
        {TOPIC_FILTERS.map((t) => (
          <button
            key={t.id || 'all'}
            type="button"
            className={`filter-btn ${topic === t.id ? 'active' : ''}`}
            onClick={() => setTopic(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="loading">ЗАВАНТАЖЕННЯ...</div>
      ) : error ? (
        <div className="error">Помилка завантаження</div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <p>КІМНАТ ПОКИ НЕМАЄ</p>
          {!isAuthenticated && <Link to="/login" className="btn">УВІЙТИ ЩОБ СТВОРИТИ</Link>}
        </div>
      ) : (
        <div className="questions-list">
          {list.map((room) => (
            <div key={room.id} className="question-card">
              <div className="question-stats">
                <div className="stat">
                  <div className="stat-value">{room.memberCount}</div>
                  <div className="stat-label">У КІМНАТІ</div>
                </div>
              </div>
              <div className="question-content">
                <span className="tag">{room.topic}</span>
                <h3>
                  <Link to={`/pair-rooms/${room.slug}`}>{room.title}</Link>
                </h3>
                {room.description && <p>{room.description}</p>}
                <p className="social-muted">
                  Хост: {room.hostUsername} · {room.memberCount}/{room.maxParticipants}
                </p>
                <Link to={`/pair-rooms/${room.slug}`} className="btn btn-primary">
                  УВІЙТИ
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
