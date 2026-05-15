/**
 * AI-генерація навчального roadmap за стеком
 */

import { useState } from 'react';
import { ai } from '../services/api';
import './AIFeatures.css';

export function AIRoadmapGenerator({
  difficulty,
  onGenerated,
}) {
  const [stack, setStack] = useState('');
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    const stackTrim = stack.trim();
    if (!stackTrim) {
      setError('Вкажіть стек (наприклад: React, Node.js, PostgreSQL)');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await ai.generateRoadmap({
        stack: stackTrim,
        goal: goal.trim() || undefined,
        level: difficulty || 'beginner',
      });
      const data = response.data?.data || response.data;
      const roadmap = data?.roadmap;
      if (!roadmap) {
        setError('AI не повернув маршрут');
        return;
      }
      onGenerated?.(roadmap);
    } catch (e) {
      console.error('AIRoadmapGenerator:', e);
      setError(e.response?.data?.message || e.response?.data?.error || 'Помилка генерації roadmap');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-panel" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="ai-panel-header ai-panel-header-accent">
        🤖 ROADMAP ЗА ВАШИМ СТЕКОМ (AI)
      </div>
      <div className="ai-panel-body">
        <p style={{ margin: '0 0 12px' }}>
          Опишіть технології — AI згенерує структурований навчальний маршрут з кроками.
        </p>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label" htmlFor="ai-stack">
            СТЕК / ТЕХНОЛОГІЇ
          </label>
          <input
            id="ai-stack"
            type="text"
            className="form-input"
            value={stack}
            onChange={(e) => setStack(e.target.value)}
            placeholder="React, TypeScript, Node.js, PostgreSQL"
            disabled={loading}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label" htmlFor="ai-goal">
            ЦІЛЬ (ОПЦІОНАЛЬНО)
          </label>
          <input
            id="ai-goal"
            type="text"
            className="form-input"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Стати junior frontend-розробником за 6 місяців"
            disabled={loading}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="ai-panel-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? '⏳ ГЕНЕРАЦІЯ...' : '✨ ЗГЕНЕРУВАТИ ROADMAP'}
          </button>
        </div>
      </div>
    </div>
  );
}
