/**
 * AI-помічник при створенні питання: дублікати + якість формулювання
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ai } from '../services/api';
import './AIFeatures.css';

const DEBOUNCE_MS = 900;

export function AIQuestionCoach({ title, body, onApplyTitle, onApplyBodyIntro }) {
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [dupMessage, setDupMessage] = useState(null);
  const [quality, setQuality] = useState(null);
  const [error, setError] = useState(null);

  const ready = title.trim().length >= 10 && body.trim().length >= 30;

  useEffect(() => {
    if (!ready) {
      setDuplicates([]);
      setDupMessage(null);
      setQuality(null);
      setError(null);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const [dupRes, qualRes] = await Promise.all([
          ai.checkDuplicate(title.trim(), body.trim()),
          ai.analyzeQuestion(title.trim(), body.trim()),
        ]);

        const dupData = dupRes.data?.data || dupRes.data;
        const qualData = qualRes.data?.data || qualRes.data;

        if (!dupData?.aiDisabled) {
          setDuplicates(dupData?.duplicates || []);
          setDupMessage(dupData?.message || null);
        } else {
          setDuplicates([]);
          setDupMessage(null);
        }

        if (!qualData?.aiDisabled) {
          setQuality(qualData);
        } else {
          setQuality(null);
        }
      } catch (e) {
        console.error('AIQuestionCoach:', e);
        setError('AI тимчасово недоступний');
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [title, body, ready]);

  if (!ready && !loading) {
    return (
      <div className="ai-panel" style={{ marginTop: 16 }}>
        <div className="ai-panel-header">🤖 AI-ПОМІЧНИК</div>
        <div className="ai-panel-body">
          <p style={{ margin: 0, opacity: 0.8 }}>
            Заповніть заголовок (10+ символів) і опис (30+), щоб AI перевірив дублікати та якість.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-panel" style={{ marginTop: 16 }}>
      <div className="ai-panel-header ai-panel-header-accent">
        🤖 AI-ПОМІЧНИК
      </div>
      <div className="ai-panel-body">
        {loading && <p style={{ margin: '0 0 12px' }}>⏳ Аналізую питання...</p>}
        {error && <p className="form-error">{error}</p>}

        {!loading && dupMessage && duplicates.length > 0 && (
          <div className="ai-panel-warn">
            <div className="ai-panel-warn-title">⚠️ {dupMessage}</div>
            <ul className="ai-panel-list">
              {duplicates.map((d) => (
                <li key={d.id} className="ai-panel-list-item">
                  <Link to={`/questions/${d.id}`} className="ai-panel-link">
                    {d.title}
                  </Link>
                  {d.reason && <p className="ai-panel-meta">{d.reason}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && quality && (
          <div>
            <div className="ai-score-row">
              <span className="ai-score-value">{quality.score}/10</span>
              <span>
                {quality.verdict === 'good'
                  ? 'Формулювання добре'
                  : 'Покращити формулювання питання?'}
              </span>
            </div>

            {quality.issues?.length > 0 && (
              <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>
                {quality.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}

            {quality.verdict === 'needs_improvement' && quality.improvedTitle && (
              <div className="ai-suggestion-box">
                <strong>Покращений заголовок:</strong>
                <p style={{ margin: '8px 0' }}>{quality.improvedTitle}</p>
                {onApplyTitle && (
                  <button type="button" className="btn btn-sm" onClick={() => onApplyTitle(quality.improvedTitle)}>
                    ЗАСТОСУВАТИ ЗАГОЛОВОК
                  </button>
                )}
              </div>
            )}

            {quality.improvedBodyIntro && (
              <div className="ai-suggestion-box" style={{ marginTop: 10 }}>
                <strong>Як краще почати опис:</strong>
                <p style={{ margin: '8px 0' }}>{quality.improvedBodyIntro}</p>
                {onApplyBodyIntro && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => onApplyBodyIntro(quality.improvedBodyIntro)}
                  >
                    ДОДАТИ ДО ОПИСУ
                  </button>
                )}
              </div>
            )}

            {quality.tips?.length > 0 && (
              <ul style={{ margin: '12px 0 0', paddingLeft: 20, fontSize: 12 }}>
                {quality.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
