/**
 * AI Question Summary Component
 * Gemini Flash для створення резюме довгих питань
 * useQuery — один запит при подвійному mount (React Strict Mode)
 */

import { useQuery } from '@tanstack/react-query';
import { ai } from '../services/api';
import './AIQuestionSummary.css';

export function AIQuestionSummary({ questionId, bodyLength }) {
  const enabled = Boolean(questionId) && bodyLength > 500;

  const { data, isLoading } = useQuery({
    queryKey: ['ai', 'summarize', questionId, bodyLength > 500],
    queryFn: async () => {
      const response = await ai.summarizeQuestion(questionId);
      return response.data.data || response.data;
    },
    enabled,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  const summary = data?.needsSummary && data?.summary ? data.summary : '';

  if (!enabled) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="ai-summary-loading">
        ⏳ ГЕНЕРАЦІЯ РЕЗЮМЕ...
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="ai-question-summary">
      <div className="ai-summary-badge">
        🤖 TL;DR (AI)
      </div>
      <div className="ai-summary-text">
        {summary}
      </div>
    </div>
  );
}
