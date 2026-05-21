/*
 * Calendar tile — small box with an orange month-band at the top
 * ("MAY" in mono-small white on orange), the day number in large serif,
 * and the weekday abbreviation in mono-tiny muted gray. Per Part V, Rail 3.
 */

export function CalendarTile({
  monthCode,
  day,
  weekday,
}: {
  monthCode: string;     // e.g. "MAY"
  day: number;           // 1–31
  weekday: string;       // "wed"
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        border: '1px solid var(--border)',
        borderRadius: 3,
        background: 'var(--bg-raised)',
        width: 56,
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
      }}
      aria-label={`${monthCode} ${day}`}
    >
      <span
        style={{
          background: 'var(--accent)',
          color: '#fff',
          fontSize: 10,
          letterSpacing: '0.14em',
          textAlign: 'center',
          padding: '3px 0',
        }}
      >
        {monthCode}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: 600,
          fontSize: 26,
          color: 'var(--text-strong)',
          textAlign: 'center',
          padding: '4px 0 0 0',
          lineHeight: 1,
        }}
      >
        {day}
      </span>
      <span
        style={{
          fontSize: 9,
          color: 'var(--text-muted)',
          textAlign: 'center',
          padding: '2px 0 4px 0',
          letterSpacing: '0.12em',
        }}
      >
        {weekday.toLowerCase()}
      </span>
    </span>
  );
}
