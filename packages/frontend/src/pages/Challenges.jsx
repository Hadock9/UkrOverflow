/**
 * Тижневі челенджі: Gemini-оцінка, підказки, прогрес, рейтинги.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { challenges as challengesApi } from '../services/api';
import wsClient from '../services/websocket';
import { notifyNotificationsUpdated } from '../utils/notificationUi';
import '../styles/brutalism.css';
import './SocialPages.css';

const TYPE_META = {
  algorithms: { label: 'АЛГОРИТМИ', color: '#9bd3ff' },
  bug_fixing: { label: 'BUG FIXING', color: '#ffb3c7' },
  mini_project: { label: 'MINI PROJECT', color: '#9ee6a0' },
};

const BREAKDOWN_LABELS = {
  correctness: 'Коректність',
  clarity: 'Зрозумілість',
  completeness: 'Повнота',
};

function ScoreBreakdown({ breakdown }) {
  if (!breakdown || typeof breakdown !== 'object') return null;
  const entries = Object.entries(breakdown).filter(([, v]) => Number.isFinite(Number(v)));
  if (entries.length === 0) return null;

  return (
    <div className="challenge-breakdown">
      <strong style={{ fontSize: '0.85rem' }}>Розбивка Gemini:</strong>
      {entries.map(([key, val]) => (
        <div key={key} className="challenge-breakdown-row">
          <span style={{ minWidth: 100 }}>{BREAKDOWN_LABELS[key] || key}</span>
          <div className="challenge-breakdown-bar">
            <div
              className="challenge-breakdown-fill"
              style={{ width: `${Math.min(100, Math.max(0, Number(val)))}%` }}
            />
          </div>
          <span>{Math.round(Number(val))}%</span>
        </div>
      ))}
    </div>
  );
}

function WeekPodium({ leaderboard }) {
  if (!leaderboard?.length) return null;
  const top = leaderboard.slice(0, 3);
  const order = top.length >= 3 ? [top[1], top[0], top[2]] : top;
  const places = top.length >= 3 ? [2, 1, 3] : top.map((_, i) => i + 1);

  return (
    <div className="challenge-podium">
      {order.map((row, i) => (
        <div key={row.userId} className={`challenge-podium-item place-${places[i]}`}>
          <div>#{row.rank}</div>
          <Link to={`/users/${row.userId}`}>{row.username}</Link>
          <div style={{ fontWeight: 700 }}>{row.totalScore} б.</div>
        </div>
      ))}
    </div>
  );
}

export function Challenges() {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [solutionText, setSolutionText] = useState('');
  const [solutionUrl, setSolutionUrl] = useState('');
  const [lastScoring, setLastScoring] = useState(null);
  const [hintData, setHintData] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['challenges-current'],
    queryFn: async () => {
      const r = await challengesApi.getCurrent();
      return r.data.data;
    },
  });

  const { data: weekHistory } = useQuery({
    queryKey: ['challenges-history'],
    queryFn: async () => {
      const r = await challengesApi.getWeekHistory({ limit: 6 });
      return r.data.data.weeks;
    },
    enabled: showHistory,
  });

  const weekChallenges = data?.challenges || [];
  const leaderboard = data?.leaderboard || [];
  const weekBounds = data?.weekBounds;
  const stats = data?.stats;
  const userProgress = data?.userProgress;

  const active = weekChallenges.find((c) => c.id === selectedId) || weekChallenges[0];

  const { data: challengeLb } = useQuery({
    queryKey: ['challenge-lb', active?.id],
    queryFn: async () => {
      const r = await challengesApi.getLeaderboard(active.id, { limit: 10 });
      return r.data.data.leaderboard;
    },
    enabled: !!active?.id,
  });

  const mySubmission = userProgress?.items?.find((i) => i.challengeId === active?.id)?.submission;

  useEffect(() => {
    const unsub = wsClient.on('challenges', () => refetch());
    return unsub;
  }, [refetch]);

  const submitMutation = useMutation({
    mutationFn: ({ id, body }) => challengesApi.submit(id, body),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['challenges-current'] });
      queryClient.invalidateQueries({ queryKey: ['challenge-lb', active?.id] });
      setLastScoring(res.data?.data?.scoring || null);
      setSolutionText('');
      setSolutionUrl('');
      setHintData(null);
      notifyNotificationsUpdated();
    },
  });

  const hintMutation = useMutation({
    mutationFn: () => challengesApi.getHint(active.id, solutionText),
    onSuccess: (res) => setHintData(res.data.data),
  });

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
            ? `Тиждень ${weekBounds.weekStart} — ${weekBounds.weekEnd}: алгоритми, bug fixing, mini projects. Оцінка Gemini + рейтинг.`
            : 'Щотижневі задачі з рейтингом учасників.'}
        </p>
      </div>

      {stats && (
        <div className="challenge-stats-row">
          <span className="challenge-stat-pill">👥 {stats.participants} учасників</span>
          <span className="challenge-stat-pill">📝 {stats.submissions} рішень</span>
          {stats.avgScore != null && (
            <span className="challenge-stat-pill">📊 сер. бал {stats.avgScore}</span>
          )}
          <span className="challenge-stat-pill">🏆 макс. {stats.topScore} б.</span>
        </div>
      )}

      {isAuthenticated && userProgress && (
        <div className="challenge-progress-grid">
          {userProgress.items.map((item) => {
            const meta = TYPE_META[item.challengeType] || { label: item.challengeType };
            const done = !!item.submission;
            return (
              <button
                key={item.challengeId}
                type="button"
                className={`challenge-progress-card ${done ? 'done' : ''}`}
                onClick={() => setSelectedId(item.challengeId)}
              >
                <div className="tag" style={{ marginBottom: 4 }}>{meta.label}</div>
                <div style={{ fontWeight: 700 }}>{item.title.slice(0, 40)}…</div>
                {done ? (
                  <div style={{ marginTop: 6 }}>
                    ✅ {item.submission.score} / {item.pointsMax} б.
                  </div>
                ) : (
                  <div className="social-muted" style={{ marginTop: 6 }}>ще не здано</div>
                )}
              </button>
            );
          })}
          <div className="challenge-progress-card" style={{ background: '#f5f4e8' }}>
            <div style={{ fontWeight: 700 }}>ВАШ ТИЖДЕНЬ</div>
            <div style={{ marginTop: 6 }}>
              {userProgress.completed}/{userProgress.total} челенджів
            </div>
            <div>{userProgress.totalScore} / {userProgress.maxPossible} б.</div>
            {userProgress.weeklyRank && (
              <div style={{ marginTop: 4 }}>Місце: #{userProgress.weeklyRank}</div>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="loading">ЗАВАНТАЖЕННЯ...</div>
      ) : error ? (
        <div className="error">Помилка завантаження</div>
      ) : (
        <div
          className="social-challenges-layout"
          style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--space-4)' }}
        >
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
                    onClick={() => {
                      setSelectedId(ch.id);
                      setLastScoring(null);
                      setHintData(null);
                    }}
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

                {mySubmission && (
                  <div
                    className="question-card"
                    style={{ marginTop: 'var(--space-2)', background: '#e8f4ff' }}
                  >
                    <p>
                      <strong>Ваше рішення:</strong> {mySubmission.score} / {active.pointsMax} б.
                      <span className="social-muted" style={{ marginLeft: 8 }}>
                        {new Date(mySubmission.submittedAt).toLocaleDateString('uk-UA')}
                      </span>
                    </p>
                    {mySubmission.aiFeedback && (
                      <p style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{mySubmission.aiFeedback}</p>
                    )}
                    <ScoreBreakdown breakdown={mySubmission.aiBreakdown} />
                  </div>
                )}

                {lastScoring && (
                  <div
                    className="question-card"
                    style={{ marginTop: 'var(--space-3)', background: '#f5f4e8' }}
                  >
                    <p>
                      <strong>Нова оцінка:</strong> {lastScoring.score} / {lastScoring.pointsMax}
                      {lastScoring.scoredBy === 'gemini' && (
                        <span className="tag" style={{ marginLeft: 8 }}>Gemini</span>
                      )}
                    </p>
                    {lastScoring.feedback && (
                      <p style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{lastScoring.feedback}</p>
                    )}
                    <ScoreBreakdown breakdown={lastScoring.breakdown} />
                  </div>
                )}

                {isAuthenticated ? (
                  <>
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
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={submitMutation.isPending}
                        >
                          {submitMutation.isPending ? 'GEMINI ОЦІНЮЄ…' : mySubmission ? 'ПЕРЕЗДАТИ' : 'НАДІСЛАТИ'}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          disabled={hintMutation.isPending}
                          onClick={() => hintMutation.mutate()}
                        >
                          {hintMutation.isPending ? '…' : '💡 ПІДКАЗКА AI'}
                        </button>
                      </div>
                    </form>

                    {hintData && (
                      <div className="challenge-hint-box">
                        <strong>Підказка Gemini</strong>
                        <p style={{ marginTop: 8 }}>{hintData.hint}</p>
                        {hintData.checklist?.length > 0 && (
                          <>
                            <p style={{ marginTop: 8, fontWeight: 700 }}>Чекліст:</p>
                            <ul>
                              {hintData.checklist.map((c) => (
                                <li key={c}>{c}</li>
                              ))}
                            </ul>
                          </>
                        )}
                        {hintData.pitfalls?.length > 0 && (
                          <>
                            <p style={{ marginTop: 8, fontWeight: 700 }}>Уникайте:</p>
                            <ul>
                              {hintData.pitfalls.map((p) => (
                                <li key={p}>{p}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <Link to="/login" className="btn btn-primary" style={{ marginTop: 'var(--space-3)' }}>
                    УВІЙТИ ЩОБ УЧАСТВУВАТИ
                  </Link>
                )}

                {challengeLb && challengeLb.length > 0 && (
                  <div style={{ marginTop: 'var(--space-4)' }}>
                    <h3 className="social-section-title">ТОП ЦЬОГО ЧЕЛЕНДЖУ</h3>
                    <ol className="social-leaderboard">
                      {challengeLb.map((row) => (
                        <li key={row.userId}>
                          <span className="social-rank">#{row.rank}</span>
                          <Link to={`/users/${row.userId}`}>{row.username}</Link>
                          <span className="social-score">{row.score} б.</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ) : (
              <p className="social-muted">Челенджі на цей тиждень ще не створені. Запустіть seed.</p>
            )}
          </div>

          <div>
            <h3 className="social-section-title">РЕЙТИНГ ТИЖНЯ</h3>
            <WeekPodium leaderboard={leaderboard} />
            {leaderboard.length === 0 ? (
              <p className="social-muted">Поки немає рішень</p>
            ) : (
              <ol className="social-leaderboard">
                {leaderboard.map((row) => (
                  <li
                    key={row.userId}
                    style={
                      user?.id === row.userId
                        ? { background: '#f5f4e8', borderColor: '#000' }
                        : undefined
                    }
                  >
                    <span className="social-rank">#{row.rank}</span>
                    <Link to={`/users/${row.userId}`}>{row.username}</Link>
                    <span className="social-score">{row.totalScore} б.</span>
                  </li>
                ))}
              </ol>
            )}

            <button
              type="button"
              className="btn"
              style={{ marginTop: 'var(--space-3)', width: '100%' }}
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? 'СХОВАТИ ІСТОРІЮ' : 'ІСТОРІЯ ТИЖНІВ'}
            </button>
            {showHistory && weekHistory && (
              <ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
                {weekHistory.map((w) => (
                  <li
                    key={w.weekStart}
                    className="challenge-stat-pill"
                    style={{ display: 'block', marginBottom: 6 }}
                  >
                    {w.weekStart} — {w.weekEnd}
                    <br />
                    <span className="social-muted">
                      {w.participantCount} уч. · {w.submissionCount} ріш.
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <Link to="/activity" className="btn" style={{ marginTop: 'var(--space-2)', display: 'inline-block' }}>
              ЖИВА АКТИВНІСТЬ
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
