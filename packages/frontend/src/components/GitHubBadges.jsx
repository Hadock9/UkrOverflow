/**
 * Колекція бейджів-досягнень з GitHub-активності.
 */

const COLOR_BY_ID = {
  'oss-builder': { bg: '#7c3aed', fg: '#fff' },
  'open-source': { bg: '#9333ea', fg: '#fff' },
  polyglot: { bg: '#0ea5e9', fg: '#fff' },
  'star-collector': { bg: '#facc15', fg: '#1f2937' },
  starred: { bg: '#fde047', fg: '#1f2937' },
  noticed: { bg: '#fef08a', fg: '#1f2937' },
  'prolific-committer': { bg: '#16a34a', fg: '#fff' },
  active: { bg: '#22c55e', fg: '#1f2937' },
  'year-grinder': { bg: '#dc2626', fg: '#fff' },
  'daily-coder': { bg: '#f97316', fg: '#fff' },
  'pr-machine': { bg: '#2563eb', fg: '#fff' },
  reviewer: { bg: '#0d9488', fg: '#fff' },
};

export function GitHubBadges({ badges }) {
  if (!badges || badges.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 13, opacity: 0.6 }}>
        Ще немає бейджів. Активність і вклад на GitHub автоматично перетворюються на досягнення тут.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {badges.map((b) => {
        const c = COLOR_BY_ID[b.id] || { bg: '#0d1117', fg: '#fff' };
        return (
          <span
            key={b.id}
            title={b.description}
            style={{
              background: c.bg,
              color: c.fg,
              padding: '4px 10px',
              border: '2px solid #000',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
            }}
          >
            ★ {b.label}
          </span>
        );
      })}
    </div>
  );
}

export default GitHubBadges;
