/**
 * Універсальна сторінка перегляду для нових типів knowledge hub:
 * roadmap, best_practice, faq.
 *
 * Експортує три компоненти, які різняться лише endpoint, ключем у data та підписом.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { api } from '../services/api';
import '../styles/brutalism.css';

function renderMarkdown(text) {
  if (!text || typeof text !== 'string') return { __html: '' };
  return { __html: DOMPurify.sanitize(marked(text)) };
}

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('uk-UA', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function HubItemDetail({ endpoint, dataKey, label, kind }) {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`${endpoint}/${id}`, { headers: { 'X-Record-View': '1' } })
      .then((r) => {
        if (cancelled) return;
        const payload = r.data?.data || r.data || {};
        setItem(payload[dataKey] || payload);
      })
      .catch((err) => {
        console.error(`Помилка завантаження ${label.toLowerCase()}:`, err);
        if (!cancelled) setItem(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, endpoint, dataKey, label]);

  if (loading) return <div className="container"><div className="loading">ЗАВАНТАЖЕННЯ...</div></div>;
  if (!item) return <div className="container"><div className="error">{label.toUpperCase()} НЕ ЗНАЙДЕНО</div></div>;

  return (
    <div className="container">
      <div className="question-header">
        <div>
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <span className="tag">{label}</span>
          </div>
          <h1 className="question-detail-title">{item.title}</h1>
          <div className="question-info">
            <span>Опубліковано: {formatDate(item.created_at)}</span>
            <span>•</span>
            <span>Переглядів: {item.views ?? 0}</span>
          </div>
        </div>
      </div>

      <div className="question-detail-card">
        <div className="question-content" style={{ width: '100%' }}>
          <div className="question-tags" style={{ marginBottom: 'var(--space-3)' }}>
            {Array.isArray(item.tags) && item.tags.map((tag, idx) => (
              <Link key={idx} to={`/tags/${tag}`} className="tag">{tag}</Link>
            ))}
          </div>

          {kind === 'roadmap' && Array.isArray(item.steps) && item.steps.length > 0 && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <h3 style={{ marginBottom: 'var(--space-2)' }}>ЕТАПИ</h3>
              <ol style={{ paddingLeft: 20 }}>
                {item.steps.map((s, idx) => (
                  <li key={idx} style={{ marginBottom: 'var(--space-2)' }}>
                    <strong>{s.title}</strong>
                    {s.description ? ` — ${s.description}` : null}
                    {s.estimated_weeks ? ` (≈${s.estimated_weeks} тиж.)` : null}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {kind === 'faq' && Array.isArray(item.qa_pairs) && item.qa_pairs.length > 0 && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <h3 style={{ marginBottom: 'var(--space-2)' }}>QA</h3>
              {item.qa_pairs.map((p, idx) => (
                <div key={idx} style={{ marginBottom: 'var(--space-3)' }}>
                  <p style={{ fontWeight: 700, margin: 0 }}>Q: {p.question}</p>
                  <p style={{ margin: 0 }}>A: {p.answer}</p>
                </div>
              ))}
            </div>
          )}

          {kind === 'best_practice' && item.rule && (
            <div style={{
              marginBottom: 'var(--space-3)',
              padding: 12,
              border: '2px solid #000',
              background: '#fff8d9',
            }}>
              <strong>ПРАВИЛО:</strong> {item.rule}
            </div>
          )}

          <div className="markdown-content" dangerouslySetInnerHTML={renderMarkdown(item.body)} />

          {kind === 'best_practice' && item.anti_patterns && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <h3>АНТИПАТЕРНИ</h3>
              <p>{item.anti_patterns}</p>
            </div>
          )}

          <div className="question-meta" style={{ marginTop: 'var(--space-4)' }}>
            <Link to={`/users/${item.author_id}`} className="author">
              {item.author_name}
            </Link>
            <span className="separator">•</span>
            <span className="date">knowledge hub / {kind}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RoadmapDetail() {
  return <HubItemDetail endpoint="/roadmaps" dataKey="roadmap" label="Roadmap" kind="roadmap" />;
}

export function BestPracticeDetail() {
  return <HubItemDetail endpoint="/best-practices" dataKey="bestPractice" label="Best practice" kind="best_practice" />;
}

export function FaqDetail() {
  return <HubItemDetail endpoint="/faqs" dataKey="faq" label="FAQ" kind="faq" />;
}

export default HubItemDetail;
