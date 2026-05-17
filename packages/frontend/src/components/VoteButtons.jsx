/**
 * Лайк / дизлайк — єдиний UI для всіх типів контенту.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { votes as votesApi } from '../services/api';

function VoteIcon({ type }) {
  if (type === 'up') {
    return (
      <svg className="vote-icon" viewBox="0 0 24 24" aria-hidden focusable="false">
        <path
          fill="currentColor"
          d="M7 22V11l4-6h6l-2 7h4L9 22H7zm-4 0V10H1v12h2z"
        />
      </svg>
    );
  }
  return (
    <svg className="vote-icon" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M17 2v11l-4 6h-6l2-7H5l6-10h6zm4 0V14h2V2h-2z"
      />
    </svg>
  );
}

export function VoteButtons({
  entityType,
  entityId,
  votes: initialTotal = 0,
  upvotes: initialUp = 0,
  downvotes: initialDown = 0,
  userVote: initialUserVote = null,
  compact = false,
  onUpdate,
  onVoted,
}) {
  const { user } = useAuth();
  const [total, setTotal] = useState(Number(initialTotal) || 0);
  const [userVote, setUserVote] = useState(initialUserVote);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTotal(Number(initialTotal) || 0);
    setUserVote(initialUserVote ?? null);
  }, [entityId, entityType, initialTotal, initialUserVote]);

  const applyStats = (stats, nextUserVote) => {
    const nextTotal = typeof stats?.total === 'number'
      ? stats.total
      : (Number(stats?.upvotes) || 0) - (Number(stats?.downvotes) || 0);
    setTotal(nextTotal);
    setUserVote(nextUserVote ?? null);
    onUpdate?.({
      votes: nextTotal,
      upvotes: stats?.upvotes,
      downvotes: stats?.downvotes,
      user_vote: nextUserVote,
    });
  };

  const handleVote = async (voteType) => {
    if (!user) {
      alert('Увійдіть, щоб голосувати');
      return;
    }
    if (loading) return;

    setLoading(true);
    try {
      const res = await votesApi.vote({ entityType, entityId, voteType });
      const payload = res.data?.data || {};
      applyStats(payload.votes, payload.userVote);
      onVoted?.(voteType);
    } catch (err) {
      alert(err.response?.data?.message || 'Помилка голосування');
    } finally {
      setLoading(false);
    }
  };

  const btnClass = (type) => {
    const base = `vote-btn vote-${type === 'up' ? 'up' : 'down'}`;
    return userVote === type ? `${base} vote-btn--active` : base;
  };

  if (compact) {
    return (
      <div
        className="vote-section vote-section--compact"
        role="group"
        aria-label="Голосування"
      >
        <button
          type="button"
          className={btnClass('up')}
          onClick={() => handleVote('up')}
          disabled={!user || loading}
          title="Лайк"
          aria-label="Лайк"
          aria-pressed={userVote === 'up'}
        >
          <VoteIcon type="up" />
        </button>
        <span className="vote-count vote-count--compact">{total}</span>
        <button
          type="button"
          className={btnClass('down')}
          onClick={() => handleVote('down')}
          disabled={!user || loading}
          title="Дизлайк"
          aria-label="Дизлайк"
          aria-pressed={userVote === 'down'}
        >
          <VoteIcon type="down" />
        </button>
      </div>
    );
  }

  return (
    <div className="vote-section" role="group" aria-label="Голосування">
      <button
        type="button"
        className={btnClass('up')}
        onClick={() => handleVote('up')}
        disabled={!user || loading}
        title="Лайк"
        aria-label="Лайк"
        aria-pressed={userVote === 'up'}
      >
        <VoteIcon type="up" />
      </button>
      <div className="vote-count" aria-live="polite">{total}</div>
      <button
        type="button"
        className={btnClass('down')}
        onClick={() => handleVote('down')}
        disabled={!user || loading}
        title="Дизлайк"
        aria-label="Дизлайк"
        aria-pressed={userVote === 'down'}
      >
        <VoteIcon type="down" />
      </button>
    </div>
  );
}

export default VoteButtons;
