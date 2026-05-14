/**
 * GitHub-style contribution heatmap.
 * Очікує дані формату { totalContributions, weeks: [{ days: [{date, count, color, weekday}] }] }.
 */

const DAY_LABELS = ['П', '', 'С', '', 'П', '', ''];
const MONTH_NAMES = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];

function levelColor(count) {
  if (!count) return '#ebedf0';
  if (count >= 10) return '#216e39';
  if (count >= 5) return '#30a14e';
  if (count >= 2) return '#40c463';
  return '#9be9a8';
}

export function ContributionHeatmap({ data }) {
  if (!data || !Array.isArray(data.weeks) || data.weeks.length === 0) {
    return (
      <div className="card" style={{ padding: 'var(--space-3)', fontSize: 13, opacity: 0.7 }}>
        Контрибуцій ще немає. Натисніть «Синхронізувати GitHub», щоб підтягнути дані.
      </div>
    );
  }

  // Розміри клітинки
  const cell = 12;
  const gap = 3;
  const weeksCount = data.weeks.length;
  const width = weeksCount * (cell + gap);
  const height = 7 * (cell + gap);

  // Визначаємо позиції міток місяців
  const monthLabels = [];
  let prevMonth = -1;
  data.weeks.forEach((w, wi) => {
    const firstDay = w.days?.[0];
    if (!firstDay?.date) return;
    const m = new Date(firstDay.date).getMonth();
    if (m !== prevMonth) {
      monthLabels.push({ x: wi * (cell + gap), label: MONTH_NAMES[m] });
      prevMonth = m;
    }
  });

  const breakdown = data.breakdown || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <strong style={{ fontFamily: 'var(--font-mono)' }}>
          {data.totalContributions ?? 0} контрибуцій за рік
        </strong>
        <span style={{ fontSize: 12, opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
          {breakdown.commits ? `${breakdown.commits} комітів · ` : ''}
          {breakdown.pullRequests ? `${breakdown.pullRequests} злиттів · ` : ''}
          {breakdown.reviews ? `${breakdown.reviews} ревʼю · ` : ''}
          {breakdown.issues ? `${breakdown.issues} задач` : ''}
        </span>
      </div>

      <div style={{ overflowX: 'auto', border: '2px solid #000', padding: 8, background: '#fff' }}>
        <svg width={width + 24} height={height + 18} style={{ display: 'block' }}>
          {monthLabels.map((m, i) => (
            <text key={i} x={m.x + 22} y={10} fontSize={10} fill="#333" fontFamily="monospace">
              {m.label}
            </text>
          ))}
          {DAY_LABELS.map((lbl, di) =>
            lbl ? (
              <text key={di} x={0} y={18 + di * (cell + gap) + cell - 2} fontSize={9} fill="#666" fontFamily="monospace">
                {lbl}
              </text>
            ) : null
          )}
          {data.weeks.map((w, wi) =>
            (w.days || []).map((d) => (
              <rect
                key={`${wi}-${d.date}`}
                x={22 + wi * (cell + gap)}
                y={18 + d.weekday * (cell + gap)}
                width={cell}
                height={cell}
                rx={2}
                ry={2}
                fill={d.color || levelColor(d.count)}
                stroke="#0d1117"
                strokeOpacity={d.count > 0 ? 0.15 : 0.05}
              >
                <title>{`${d.date}: ${d.count} contribution(s)`}</title>
              </rect>
            ))
          )}
        </svg>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, opacity: 0.7 }}>
        <span>Менше</span>
        {[0, 1, 2, 5, 10].map((c) => (
          <span key={c} style={{ width: 12, height: 12, background: levelColor(c), border: '1px solid #0d1117' }} />
        ))}
        <span>Більше</span>
      </div>
    </div>
  );
}

export default ContributionHeatmap;
