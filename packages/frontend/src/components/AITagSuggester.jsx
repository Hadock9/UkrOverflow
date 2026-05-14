/**
 * AI Tag Suggester Component
 * Gemini Flash для автоматичного підбору тегів
 */

import { useState } from 'react';
import { ai } from '../services/api';
import './AITagSuggester.css';

export function AITagSuggester({ title, body, onTagsSelected }) {
  const [loading, setLoading] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [error, setError] = useState('');

  const handleGenerateTags = async () => {
    if (!title || !body) {
      setError('Спочатку введіть заголовок та опис питання');
      return;
    }

    setLoading(true);
    setError('');
    setSuggestedTags([]);

    try {
      const response = await ai.suggestTags(title, body);
      const tags = response.data.data?.tags || response.data.tags || [];

      setSuggestedTags(tags);

      if (tags.length === 0) {
        setError('Не вдалося згенерувати теги');
      }
    } catch (err) {
      console.error('AI Tag Error:', err);
      setError(err.response?.data?.message || 'Помилка генерації тегів');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTag = (tag) => {
    if (onTagsSelected) {
      onTagsSelected([tag]);
    }
  };

  const handleSelectAllTags = () => {
    if (onTagsSelected) {
      onTagsSelected(suggestedTags);
    }
    setSuggestedTags([]);
  };

  return (
    <div className="ai-tag-suggester">
      <button
        className="ai-tag-btn"
        onClick={handleGenerateTags}
        disabled={loading || !title || !body}
        type="button"
      >
        {loading ? '⏳ ГЕНЕРАЦІЯ...' : '🏷️ AI ТЕГИ'}
      </button>

      {error && (
        <div className="ai-tag-error">
          ⚠️ {error}
        </div>
      )}

      {suggestedTags.length > 0 && (
        <div className="ai-tag-suggestions">
          <div className="ai-tag-header">
            <span>🤖 ЗАПРОПОНОВАНІ ТЕГИ:</span>
            <button
              className="ai-tag-select-all"
              onClick={handleSelectAllTags}
              type="button"
            >
              ✓ ОБРАТИ ВСІ
            </button>
          </div>

          <div className="ai-tag-list">
            {suggestedTags.map((tag, index) => (
              <button
                key={index}
                className="ai-tag-item"
                onClick={() => handleSelectTag(tag)}
                type="button"
              >
                {tag} +
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
