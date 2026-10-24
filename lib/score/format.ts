/*
 * Small display helpers shared by the score components. Manual month
 * names rather than toLocaleDateString, so server and client render the
 * same string and hydration never mismatches.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function shortDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function weekRange(start: string): string {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(s);
  e.setUTCDate(e.getUTCDate() + 6);
  const sm = MONTHS[s.getUTCMonth()], em = MONTHS[e.getUTCMonth()];
  return sm === em
    ? `${s.getUTCDate()} to ${e.getUTCDate()} ${em}`
    : `${s.getUTCDate()} ${sm} to ${e.getUTCDate()} ${em}`;
}

export function pts(n: number): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? 'point' : 'points'}`;
}
