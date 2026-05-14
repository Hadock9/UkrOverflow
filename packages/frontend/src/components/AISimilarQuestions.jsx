/**
 * AI Similar Questions Component
 * Gemini Flash для пошуку схожих питань
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ai } from '../services/api';
import './AISimilarQuestions.css';

export function AISimilarQuestions({ questionId }) {
  const [loading, setLoading] = useState(true);
  const [similarQuestions, setSimilarQuestions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSimilarQuestions();
  }, [questionId]);

  const loadSimilarQuestions = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await ai.findSimilarQuestions(questionId);
      const questions = response.data.data?.similarQuestions || response.data.similarQuestions || [];

      setSimilarQuestions(questions);
    } catch (err) {
      console.error('AI Similar Questions Error:', err);
      setError('');
      setSimilarQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="ai-similar-loading">
        <span>⏳ ПОШУК СХОЖИХ ПИТАНЬ...</span>
      </div>
    );
  }

  if (error || similarQuestions.length === 0) {
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
