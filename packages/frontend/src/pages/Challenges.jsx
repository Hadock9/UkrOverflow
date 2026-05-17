/**
 * Тижневі челенджі та рейтинг.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { challenges as challengesApi } from '../services/api';
import wsClient from '../services/websocket';
import '../styles/brutalism.css';
import './SocialPages.css';

const TYPE_META = {
  algorithms: { label: 'АЛГОРИТМИ', color: '#9bd3ff' },
  bug_fixing: { label: 'BUG FIXING', color: '#ffb3c7' },
  mini_project: { label: 'MINI PROJECT', color: '#9ee6a0' },
};

export function Challenges() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [solutionText, setSolutionText] = useState('');
  const [solutionUrl, setSolutionUrl] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['challenges-current'],
    queryFn: async () => {
      const r = await challengesApi.getCurrent();
      return r.data.data;
    },
  });

  useEffect(() => {
    const unsub = wsClient.on('challenges', () => refetch());
    return unsub;
  }, [refetch]);

  const submitMutation = useMutation({
    mutationFn: ({ id, body }) => challengesApi.submit(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges-current'] });
      setSolutionText('');
      setSolutionUrl('');
    },
  });

  const weekChallenges = data?.challenges || [];
  const leaderboard = data?.leaderboard || [];
  const weekBounds = data?.weekBounds;

  const active = weekChallenges.find((c) => c.id === selectedId) || weekChallenges[0];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!active?.id || !isAuthenticated) return;
    submitMutation.mutate({
      id: active.id,
      body: { solutionText, solutionUrl: solutionUrl || undefined },
    });
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">ЧЕЛЕНДЖІ ТИЖНЯ</h1>
        <p className="page-subtitle">
          {weekBounds
            ? `Тиждень ${weekBounds.weekStart} — ${weekBounds.weekEnd}: алгоритми, виправлення багів та міні-проєкти.`
            : 'Щотижневі задачі з рейтингом учасників.'}
        </p>
      </div>

      {isLoading ? (
        <div className="loading">ЗАВАНТАЖЕННЯ...</div>
      ) : error ? (
        <div className="error">Помилка завантаження</div>
      ) : (
        <div className="social-challenges-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--space-4)' }}>
          <div>
            <div className="social-challenge-types">
              {weekChallenges.map((ch) => {
                const meta = TYPE_META[ch.challengeType] || { label: ch.challengeType, color: '#fff' };
                return (
                  <button
                    key={ch.id}
                    type="button"
                    className={`social-type-badge filter-btn ${active?.id === ch.id ? 'active' : ''}`}
                    style={{ background: active?.id === ch.id ? meta.color : undefined }}
                    onClick={() => setSelectedId(ch.id)}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>

            {active ? (
              <div className="question-card">
                <h2>{active.title}</h2>
                <p style={{ whiteSpace: 'pre-wrap' }}>{active.description}</p>
                <p className="social-muted">
                  Макс. балів: {active.pointsMax} · Учасників: {active.submissionCount || 0}
                </p>

                {isAuthenticated ? (
                  <form onSubmit={handleSubmit} style={{ marginTop: 'var(--space-3)' }}>
                    <textarea
                      className="input"
                      rows={6}
                      placeholder="Опишіть рішення (код, підхід, посилання на gist)..."
                      value={solutionText}
                      onChange={(e) => setSolutionText(e.target.value)}
                      required
                      minLength={10}
                    />
                    <input
                      className="input"
                      type="url"
                      placeholder="Посилання на репозиторій (необовʼязково)"
                      value={solutionUrl}
                      onChange={(e) => setSolutionUrl(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary" disabled={submitMutation.isPending}>
                      НАДІСЛАТИ РІШЕННЯ
                    </button>
                  </form>
                ) : (
                  <Link to="/login" className="btn btn-primary">УВІЙТИ ЩОБ УЧАСТВУВАТИ</Link>
                )}
              </div>
            ) : (
              <p className="social-muted">Челенджі на цей тиждень ще не створені. Запустіть seed.</p>
            )}
          </div>

          <div>
            <h3 className="social-section-title">РЕЙТИНГ ТИЖНЯ</h3>
            {leaderboard.length === 0 ? (
              <p className="social-muted">Поки немає рішень</p>
            ) : (
              <ol className="social-leaderboard">
                {leaderboard.map((row) => (
                  <li key={row.userId}>
                    <span className="social-rank">#{row.rank}</span>
                    <Link to={`/users/${row.userId}`}>{row.username}</Link>
                    <span className="social-score">{row.totalScore} б.</span>
                  </li>
                ))}
              </ol>
            )}
            <Link to="/activity" className="btn" style={{ marginTop: 'var(--space-3)', display: 'inline-block' }}>
              ЖИВА АКТИВНІСТЬ
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
