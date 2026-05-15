/**
 * Сторінка перегляду guide.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useAuth } from '../contexts/AuthContext';
import { guides } from '../services/api';
import { LinkedReposPanel } from '../components/LinkedReposPanel';
import { VoteButtons } from '../components/VoteButtons';
import '../styles/brutalism.css';

const DIFFICULTY_LABELS = {
  beginner: 'Початковий',
  intermediate: 'Середній',
  advanced: 'Просунутий',
};

export function GuideDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGuide();
  }, [id]);

  const loadGuide = async () => {
    setLoading(true);
    try {
      const response = await guides.get(id, { headers: { 'X-Record-View': '1' } });
      const guideData = response.data.data?.guide || response.data.guide || response.data;
      setGuide(guideData);
    } catch (error) {
      console.error('Помилка завантаження гайду:', error);
      setGuide(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Ви впевнені, що хочете видалити цей гайд?')) return;
    try {
      await guides.delete(id);
      navigate('/');
    } catch (error) {
      console.error('Помилка видалення гайду:', error);
      alert(error.response?.data?.message || 'Помилка видалення гайду');
    }
  };

  const renderMarkdown = (text) => {
    if (!text || typeof text !== 'string') return { __html: '' };
    return { __html: DOMPurify.sanitize(marked(text)) };
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleString('uk-UA', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  if (loading) return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;
  if (!guide) return <div className="container"><div className="error">ГАЙД НЕ ЗНАЙДЕНО</div></div>;

  const canManage = user && (user.id === guide.author_id || user.role === 'admin');

  return (
    <div className="container">
      <div className="question-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ marginBottom: 'var(--space-2)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="tag">Гайд</span>
              <span className="badge">{DIFFICULTY_LABELS[guide.difficulty] || guide.difficulty}</span>
              <span className="badge">{guide.estimated_minutes} хв</span>
            </div>
            <h1 className="question-detail-title">{guide.title}</h1>
            <div className="question-info">
              <span>Опубліковано: {formatDate(guide.created_at)}</span>
              <span>•</span>
              <span>Переглядів: {guide.views}</span>
            </div>
          </div>
          {canManage && (
            <div className="question-actions" style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Link to={`/guides/${guide.id}/edit`} className="btn btn-secondary btn-sm">РЕДАГУВАТИ</Link>
              <button type="button" onClick={handleDelete} className="btn btn-danger btn-sm">ВИДАЛИТИ</button>
            </div>
          )}
        </div>
      </div>

      <div className="question-detail-card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="question-content" style={{ width: '100%' }}>
          <p style={{ margin: 0, fontSize: '1.125rem' }}>{guide.summary}</p>
        </div>
      </div>

      <div className="question-detail-card">
        <VoteButtons
          entityType="guide"
          entityId={guide.id}
          votes={guide.votes}
          upvotes={guide.upvotes}
          downvotes={guide.downvotes}
          userVote={guide.user_vote}
        />
        <div className="question-detail-content">
          <div className="question-content" style={{ width: '100%' }}>
          <div className="question-tags" style={{ marginBottom: 'var(--space-3)' }}>
            {Array.isArray(guide.tags) && guide.tags.map((tag, index) => <Link key={index} to={`/tags/${tag}`} className="tag">{tag}</Link>)}
          </div>
          <div className="markdown-content" dangerouslySetInnerHTML={renderMarkdown(guide.body)} />
          <div className="question-meta" style={{ marginTop: 'var(--space-4)' }}>
            <Link to={`/users/${guide.author_id}`} className="author">{guide.author_name}</Link>
            <span className="separator">•</span>
            <span className="date">knowledge hub / guide</span>
          </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-4)' }}>
        <LinkedReposPanel targetType="guide" targetId={guide.id} />
      </div>
    </div>
  );
}

export default GuideDetail;
