/**
 * AI Assistant Component
 * Gemini-powered помічник для генерації відповідей
 */

import { useState } from 'react';
import { ai } from '../services/api';
import './AIAssistant.css';

export function AIAssistant({ questionId, onSuggestionReceived }) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [error, setError] = useState('');
  const [showSuggestion, setShowSuggestion] = useState(false);

  const handleGenerateSuggestion = async () => {
    setLoading(true);
    setError('');
    setSuggestion('');
    setShowSuggestion(false);

    try {
      const response = await ai.suggestAnswer(questionId);
      const suggestionText = response.data.data?.suggestion || response.data.suggestion;

      setSuggestion(suggestionText);
      setShowSuggestion(true);
    } catch (err) {
      console.error('AI Error:', err);
      const data = err.response?.data;
      const parts = [data?.message, data?.error].filter(Boolean);
      setError(parts.length ? parts.join(' — ') : 'Помилка генерації підказки');
    } finally {
      setLoading(false);
    }
  };

  const handleUseSuggestion = () => {
    if (onSuggestionReceived) {
      onSuggestionReceived(suggestion);
    }
    setShowSuggestion(false);
  };

  const handleDiscard = () => {
    setSuggestion('');
    setShowSuggestion(false);
  };

  return (
    <div className="ai-assistant">
      {!showSuggestion && (
        <button
          className="ai-btn"
          onClick={handleGenerateSuggestion}
          disabled={loading}
        >
          {loading ? (
            <>⏳ ГЕНЕРАЦІЯ...</>
          ) : (
            <>✨ AI ПІДКАЗКА</>
          )}
        </button>
      )}

      {error && (
        <div className="ai-error">
          ❌ {error}
        </div>
      )}

      {showSuggestion && suggestion && (
        <div className="ai-suggestion-box">
          <div className="ai-suggestion-header">
            <span className="ai-badge">🤖 GEMINI PRO</span>
            <button className="ai-close-btn" onClick={handleDiscard}>
              ✕
            </button>
          </div>

          <div className="ai-suggestion-content">
            <pre>{suggestion}</pre>
          </div>

          <div className="ai-suggestion-actions">
            <button className="ai-use-btn" onClick={handleUseSuggestion}>
              ✓ ВИКОРИСТАТИ
            </button>
            <button className="ai-discard-btn" onClick={handleDiscard}>
              ✕ ВІДХИЛИТИ
            </button>
          </div>

          <div className="ai-disclaimer">
            ⚠️ Це AI-підказка. Перевірте та відредагуйте перед публікацією.
          </div>
        </div>
      )}
    </div>
  );
}
