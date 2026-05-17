/**
 * Резервна евристична оцінка, якщо Gemini недоступний.
 */

export function heuristicChallengeScore(solutionText, solutionUrl, pointsMax = 100) {
  const maxPts = Math.min(500, Math.max(10, Number(pointsMax) || 100));
  const text = String(solutionText || '').trim();
  let pts = 20;

  if (text.length >= 80) pts += 15;
  if (text.length >= 200) pts += 10;
  if (text.length >= 500) pts += 10;
  if (/```[\s\S]*?```/.test(text)) pts += 15;
  if (/\bfunction\b|\bconst\b|\bclass\b|\breturn\b/i.test(text)) pts += 10;
  if (solutionUrl) pts += 10;
  if (/\bO\(|складність|complexity|root cause|bug|fix/i.test(text)) pts += 10;

  return Math.min(maxPts, Math.max(10, Math.round(pts)));
}
