/**
 * AI-резюме дискусії (відповідей на питання)
 */

import { useQuery } from '@tanstack/react-query';
import { ai } from '../services/api';
import './AIFeatures.css';

export function AIAnswersSummary({ questionId, answerCount }) {
  const enabled = Boolean(questionId) && (answerCount ?? 0) >= 1;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ai', 'summarize-answers', questionId, answerCount],
    queryFn: async () => {
      const response = await ai.summarizeAnswers(questionId);
      return response.data.data || response.data;
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  if (!enabled) return null;

  if (isLoading) {
    return <div className="ai-panel-loading">⏳ AI АНАЛІЗУЄ ВІДПОВІДІ...</div>;
  }

  if (isError || data?.aiDisabled || !data?.needsSummary || !data?.summary) {
    return null;
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-header ai-panel-header-accent">
        🤖 РЕЗЮМЕ ВІДПОВІДЕЙ (AI)
      </div>
      <div className="ai-panel-body">
        <p style={{ margin: 0 }}>{data.summary}</p>
        {data.answerCount > 0 && (
          <p className="ai-panel-meta" style={{ marginTop: 12, marginBottom: 0 }}>
            На основі {data.answerCount} відповід{data.answerCount === 1 ? 'і' : 'ей'}
          </p>
        )}
      </div>
    </div>
  );
}
