/**
 * Анонімне опитування (грейд) — натхнення DOU Salary Report.
 */

import { useEffect, useState } from 'react';
import { news } from '../services/api';

export function NewsPollWidget() {
  const [poll, setPoll] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const res = await news.getPoll();
      const data = res.data?.data || {};
      setPoll(data.poll || null);
      setMyVote(data.myVote || null);
    } catch {
      setPoll(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onVote = async (optionId) => {
    if (!poll || myVote || voting) return;
    setVoting(true);
    setError(null);
    try {
      const res = await news.votePoll(poll.id, optionId);
      const data = res.data?.data || {};
      setPoll(data.poll || poll);
      setMyVote(data.myVote || optionId);
    } catch (e) {
      setError(e.response?.data?.message || 'Не вдалося проголосувати');
    } finally {
      setVoting(false);
    }
  };

  if (loading) return null;
  if (!poll) {
    return (
      <div className="news-sidebar-box">
        <p className="news-sidebar-muted">Опитування зʼявиться після npm run seed:news-poll</p>
      </div>
    );
  }

  const total = poll.totalVotes || 0;

  return (
    <div className="news-sidebar-box news-sidebar-box--poll">
      <h3 className="news-sidebar-title">📊 ОПИТУВАННЯ</h3>
      <p className="news-poll-question">{poll.title}</p>
      {poll.description && (
        <p className="news-sidebar-muted">{poll.description}</p>
      )}
      <ul className="news-poll-options">
        {poll.options.map((opt) => {
          const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
          const selected = myVote === opt.id;
          return (
            <li key={opt.id}>
              <button
                type="button"
                className={`news-poll-option ${selected ? 'news-poll-option--voted' : ''}`}
                disabled={Boolean(myVote) || voting}
                onClick={() => onVote(opt.id)}
              >
                <span className="news-poll-option-label">{opt.label}</span>
                {(myVote || total > 0) && (
                  <span className="news-poll-option-bar-wrap">
                    <span className="news-poll-option-bar" style={{ width: `${pct}%` }} />
                    <span className="news-poll-option-pct">{pct}% ({opt.votes})</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {myVote && (
        <p className="news-sidebar-muted">Дякуємо! Ваш голос враховано ({total} голосів).</p>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

export default NewsPollWidget;
