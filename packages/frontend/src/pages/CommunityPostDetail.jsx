/**
 * Сторінка детального перегляду поста спільноти + коментарі.
 */

import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useAuth } from '../contexts/AuthContext';
import { communityPosts } from '../services/api';
import { CONTENT_TYPES } from '../constants/contentTypes';
import { VoteButtons } from '../components/VoteButtons';
import '../styles/brutalism.css';

const POST_TYPE_LABEL = {
  discussion: 'ОБГОВОРЕННЯ',
  pet_project: 'ПЕТ-ПРОЄКТ',
  code_review: 'ПЕРЕГЛЯД КОДУ',
  mentor_request: 'ШУКАЮ МЕНТОРА',
  roadmap_request: 'ШУКАЮ МАРШРУТ НАВЧАННЯ',
  team_search: 'ШУКАЮ КОМАНДУ',
  event: 'ПОДІЯ',
  announcement: 'АНОНС',
};

const PROJECT_STAGE_UK = {
  idea: 'Ідея',
  mvp: 'MVP',
  production: 'Продакшн',
};

function renderMarkdown(text) {
  if (!text || typeof text !== 'string') return { __html: '' };
  return { __html: DOMPurify.sanitize(marked(text)) };
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function MetadataBlock({ type, metadata }) {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata;
  if (type === 'pet_project') {
    return (
      <div style={brutBox}>
        <div style={brutTitle}>ПЕТ-ПРОЄКТ</div>
        {Array.isArray(m.roles) && m.roles.length > 0 && (
          <div><strong>Ролі:</strong> {m.roles.join(', ')}</div>
        )}
        {m.commitmentHoursWeek !== undefined && (
          <div><strong>Час:</strong> {m.commitmentHoursWeek} год / тиждень</div>
        )}
        {m.projectStage && (
          <div><strong>Стадія:</strong> {PROJECT_STAGE_UK[m.projectStage] || m.projectStage}</div>
        )}
      </div>
    );
  }
  if (type === 'code_review') {
    return (
      <div style={brutBox}>
        <div style={brutTitle}>ПЕРЕГЛЯД КОДУ</div>
        {m.repoUrl && (<div><strong>Репозиторій:</strong> <a href={m.repoUrl} target="_blank" rel="noreferrer">{m.repoUrl}</a></div>)}
        {m.prUrl && (<div><strong>Запит на злиття:</strong> <a href={m.prUrl} target="_blank" rel="noreferrer">{m.prUrl}</a></div>)}
        {Array.isArray(m.focusAreas) && m.focusAreas.length > 0 && (
          <div><strong>Фокус:</strong> {m.focusAreas.join(', ')}</div>
        )}
      </div>
    );
  }
  if (type === 'mentor_request') {
    return (
      <div style={brutBox}>
        <div style={brutTitle}>ШУКАЮ МЕНТОРА</div>
        {m.topic && <div><strong>Тема:</strong> {m.topic}</div>}
        {m.currentLevel && <div><strong>Рівень:</strong> {m.currentLevel}</div>}
        {m.goal && <div><strong>Мета:</strong> {m.goal}</div>}
      </div>
    );
  }
  if (type === 'roadmap_request') {
    return (
      <div style={brutBox}>
        <div style={brutTitle}>ШУКАЮ НАВЧАЛЬНИЙ МАРШРУТ</div>
        {m.goal && <div><strong>Мета:</strong> {m.goal}</div>}
        {Array.isArray(m.currentSkills) && m.currentSkills.length > 0 && (
          <div><strong>Вмію:</strong> {m.currentSkills.join(', ')}</div>
        )}
        {m.timelineMonths !== undefined && <div><strong>Термін:</strong> {m.timelineMonths} міс.</div>}
      </div>
    );
  }
  if (type === 'team_search') {
    return (
      <div style={brutBox}>
        <div style={brutTitle}>ШУКАЮ КОМАНДУ</div>
        {Array.isArray(m.roles) && m.roles.length > 0 && <div><strong>Ролі:</strong> {m.roles.join(', ')}</div>}
      </div>
    );
  }
  if (type === 'event') {
    return (
      <div style={brutBox}>
        <div style={brutTitle}>ПОДІЯ</div>
        {m.location && <div><strong>Місце:</strong> {m.location}</div>}
        {m.eventDate && <div><strong>Дата:</strong> {formatDate(m.eventDate)}</div>}
        {m.eventLink && <div><strong>Посилання:</strong> <a href={m.eventLink} target="_blank" rel="noreferrer">{m.eventLink}</a></div>}
      </div>
    );
  }
  return null;
}

function hubMaterialPath(type, entityId) {
  if (!type || !entityId) return null;
  switch (type) {
    case CONTENT_TYPES.ARTICLE: return `/articles/${entityId}`;
    case CONTENT_TYPES.GUIDE: return `/guides/${entityId}`;
    case CONTENT_TYPES.SNIPPET: return `/snippets/${entityId}`;
    case CONTENT_TYPES.ROADMAP: return `/roadmaps/${entityId}`;
    case CONTENT_TYPES.BEST_PRACTICE: return `/best-practices/${entityId}`;
    case CONTENT_TYPES.FAQ: return `/faqs/${entityId}`;
    case CONTENT_TYPES.QUESTION: return `/questions/${entityId}`;
    default: return null;
  }
}

const brutBox = {
  border: '3px solid #000',
  background: '#fff',
  boxShadow: '4px 4px 0 #000',
  padding: 12,
  marginBottom: 16,
  fontFamily: 'var(--font-mono)',
  fontSize: 14,
  display: 'grid',
  gap: 4,
};
const brutTitle = {
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: 'uppercase',
  fontSize: 12,
  paddingBottom: 6,
  borderBottom: '2px solid #000',
  marginBottom: 6,
};

function CommentList({ comments, currentUserId, onDelete }) {
  if (!comments?.length) {
    return <div className="empty-state"><p>КОМЕНТАРІВ НЕМАЄ</p></div>;
  }
  const byParent = new Map();
  comments.forEach((c) => {
    const key = c.parent_id || 0;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(c);
  });

  const renderNode = (c, depth = 0) => (
    <div
      key={c.id}
      style={{
        border: '3px solid #000',
        background: '#fff',
        boxShadow: '4px 4px 0 #000',
        padding: 12,
        marginLeft: depth * 24,
        marginTop: 12,
        fontFamily: 'var(--font-mono)',
        fontSize: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Link to={`/users/${c.author_id}`} style={{ fontWeight: 700 }}>{c.author_name}</Link>
        <span style={{ fontSize: 12, color: '#444' }}>{formatDate(c.created_at)}</span>
        <VoteButtons
          entityType="community_post_comment"
          entityId={c.id}
          votes={c.votes}
          upvotes={c.upvotes}
          downvotes={c.downvotes}
          userVote={c.user_vote}
          compact
        />
      </div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
      {currentUserId === c.author_id && (
        <button
          type="button"
          onClick={() => onDelete(c.id)}
          className="btn btn-secondary"
          style={{ marginTop: 8, padding: '4px 10px', fontSize: 12 }}
        >
          ВИДАЛИТИ
        </button>
      )}
      {(byParent.get(c.id) || []).map((child) => renderNode(child, Math.min(depth + 1, 3)))}
    </div>
  );

  return <div>{(byParent.get(0) || []).map((c) => renderNode(c, 0))}</div>;
}

export function CommunityPostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [commentBody, setCommentBody] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['community-post', id],
    queryFn: async () => (await communityPosts.get(id, { headers: { 'X-Record-View': '1' } })).data.data.post,
    enabled: !!id,
  });

  const { data: comments, isLoading: cLoading } = useQuery({
    queryKey: ['community-post-comments', id],
    queryFn: async () => (await communityPosts.listComments(id)).data.data.comments || [],
    enabled: !!id,
  });

  const addCommentMutation = useMutation({
    mutationFn: (body) => communityPosts.addComment(id, { body }),
    onSuccess: () => {
      setCommentBody('');
      qc.invalidateQueries({ queryKey: ['community-post-comments', id] });
      qc.invalidateQueries({ queryKey: ['community-post', id] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (cid) => communityPosts.deleteComment(cid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community-post-comments', id] }),
  });

  const closeMutation = useMutation({
    mutationFn: (status) => communityPosts.close(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community-post', id] }),
  });

  if (isLoading) return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;
  if (!data) return <div className="container"><div className="error">ПОСТ НЕ ЗНАЙДЕНО</div></div>;

  const isAuthor = user?.id === data.author_id;
  const typeLabel = POST_TYPE_LABEL[data.type] || data.type;

  return (
    <div className="container">
      <div className="question-header">
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
            <span className="tag tag-accent tag-sm">{typeLabel}</span>
            <span className={`tag tag-sm tag-status-${data.status || 'open'}`}>
              {data.status}
            </span>
            {data.community_slug && (
              <Link to={`/communities/${data.community_slug}`} className="tag">
                ↩ {data.community_name}
              </Link>
            )}
          </div>
          <h1 className="question-detail-title">{data.title}</h1>
          <div className="question-info">
            <Link to={`/users/${data.author_id}`} className="author">{data.author_name}</Link>
            <span>•</span>
            <span>{formatDate(data.created_at)}</span>
            <span>•</span>
            <span>Переглядів: {data.views || 0}</span>
            <span>•</span>
          </div>
        </div>
        {isAuthor && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to={`/community-posts/${id}/edit`} className="btn btn-secondary">
              РЕДАГУВАТИ
            </Link>
            {data.status === 'open' && (
              <>
                <button className="btn btn-secondary" onClick={() => closeMutation.mutate('closed')}>
                  ЗАКРИТИ
                </button>
                <button className="btn btn-secondary" onClick={() => closeMutation.mutate('filled')}>
                  ПОЗНАЧИТИ ЗАПОВНЕНИМ
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="question-detail-card">
        <VoteButtons
          entityType="community_post"
          entityId={data.id}
          votes={data.votes}
          upvotes={data.upvotes}
          downvotes={data.downvotes}
          userVote={data.user_vote}
        />
        <div className="question-detail-content">
          <div className="question-content" style={{ width: '100%' }}>
          <MetadataBlock type={data.type} metadata={data.metadata} />

          {data.linked_content_type && data.linked_content_id && hubMaterialPath(data.linked_content_type, data.linked_content_id) && (
            <div style={brutBox}>
              <div style={brutTitle}>ПОСИЛАННЯ НА МАТЕРІАЛ ХАБУ</div>
              <Link to={hubMaterialPath(data.linked_content_type, data.linked_content_id)}>
                Відкрити пов’язаний матеріал (#{data.linked_content_id})
              </Link>
            </div>
          )}

          <div dangerouslySetInnerHTML={renderMarkdown(data.body)} />

          {Array.isArray(data.stack) && data.stack.length > 0 && (
            <div className="question-tags" style={{ marginTop: 16 }}>
              {data.stack.map((s) => (
                <span key={s} className="tag">{s}</span>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>
          КОМЕНТАРІ ({data.comment_count || comments?.length || 0})
        </h2>
        {cLoading ? (
          <div className="loading">ЗАВАНТАЖЕННЯ...</div>
        ) : (
          <CommentList
            comments={comments || []}
            currentUserId={user?.id}
            onDelete={(cid) => {
              if (confirm('Видалити коментар?')) deleteCommentMutation.mutate(cid);
            }}
          />
        )}

        {user ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (commentBody.trim().length < 1) return;
              addCommentMutation.mutate(commentBody.trim());
            }}
            style={{ marginTop: 16 }}
          >
            <textarea
              className="form-textarea"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={4}
              placeholder="Ваш коментар..."
              maxLength={5000}
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: 8 }}
              disabled={addCommentMutation.isPending || !commentBody.trim()}
            >
              {addCommentMutation.isPending ? 'НАДСИЛАННЯ...' : 'НАДІСЛАТИ'}
            </button>
          </form>
        ) : (
          <div className="empty-state" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => navigate('/login')}>
              УВІЙТИ ЩОБ КОМЕНТУВАТИ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CommunityPostDetail;
