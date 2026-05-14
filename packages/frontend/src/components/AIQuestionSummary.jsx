/**
 * AI Question Summary Component
 * Gemini Flash для створення резюме довгих питань
 */

import { useState, useEffect } from 'react';
import { ai } from '../services/api';
import './AIQuestionSummary.css';

export function AIQuestionSummary({ questionId, bodyLength }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    // Автоматично генеруємо резюме для довгих питань (>500 символів)
    if (bodyLength > 500) {
      loadSummary();
    }
  }, [questionId, bodyLength]);

  const loadSummary = async () => {
    setLoading(true);

    try {
      const response = await ai.summarizeQuestion(questionId);
      const data = response.data.data || response.data;

      if (data.needsSummary && data.summary) {
        setSummary(data.summary);
        setShowSummary(true);
      }
    } catch (err) {
      console.error('AI Summary Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="ai-summary-loading">
        ⏳ ГЕНЕРАЦІЯ РЕЗЮМЕ...
      </div>
    );
  }

  if (!showSummary || !summary) {
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
