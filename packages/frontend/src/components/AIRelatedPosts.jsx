/**
 * AI-рекомендації пов'язаного контенту хабу
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ai } from '../services/api';
import { getContentDetailPath, getContentTypeMeta } from '../constants/contentTypes';
import './AIFeatures.css';

export function AIRelatedPosts({ questionId }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['ai', 'related-content', questionId],
    queryFn: async () => {
      const response = await ai.relatedContent(questionId);
      return response.data.data || response.data;
    },
    enabled: Boolean(questionId),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  const related = data?.related ?? [];

  if (isLoading) {
    return <div className="ai-panel-loading">⏳ AI ПІДБИРАЄ МАТЕРІАЛИ...</div>;
  }

  if (isError || data?.aiDisabled || related.length === 0) {
    return null;
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        🤖 РЕКОМЕНДОВАНО ДЛЯ ВАС (AI)
      </div>
      <ul className="ai-panel-list ai-panel-body" style={{ paddingTop: 0 }}>
        {related.map((item) => {
          const meta = getContentTypeMeta(item.type);
          return (
            <li key={`${item.type}-${item.id}`} className="ai-panel-list-item">
              <span className="ai-type-badge">{meta?.shortLabel || item.type}</span>
              <Link to={getContentDetailPath(item.type, item.id)} className="ai-panel-link">
                {item.title}
              </Link>
              {item.reason && <p className="ai-panel-meta">{item.reason}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
