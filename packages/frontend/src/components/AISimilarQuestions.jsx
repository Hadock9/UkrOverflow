/**
 * AI Similar Questions Component
 * Gemini Flash для пошуку схожих питань
 * useQuery — один запит при подвійному mount (React Strict Mode)
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ai } from '../services/api';
import './AISimilarQuestions.css';

export function AISimilarQuestions({ questionId }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['ai', 'similar-questions', questionId],
    queryFn: async () => {
      const response = await ai.findSimilarQuestions(questionId);
      return response.data.data || response.data;
    },
    enabled: Boolean(questionId),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  const similarQuestions = data?.similarQuestions ?? [];

  if (isLoading) {
    return (
      <div className="ai-similar-loading">
        <span>⏳ ПОШУК СХОЖИХ ПИТАНЬ...</span>
      </div>
    );
  }

  if (isError || similarQuestions.length === 0) {
    return null;
  }

  return (
    <div className="ai-similar-questions">
      <div className="ai-similar-header">
        <span>🤖 СХОЖІ ПИТАННЯ (AI)</span>
      </div>

      <div className="ai-similar-list">
        {similarQuestions.map((question) => (
          <Link
            key={question.id}
            to={`/questions/${question.id}`}
            className="ai-similar-item"
          >
            <div className="ai-similar-title">{question.title}</div>
            <div className="ai-similar-stats">
              <span>👁️ {question.views || 0}</span>
              <span>💬 {question.answers_count || 0}</span>
              <span>⬆️ {question.votes || 0}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
