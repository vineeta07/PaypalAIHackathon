// ISO-8601 week helpers ("2026-W46").
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
/** Monday 12:00 UTC of an ISO week key. */
export function weekStart(key) {
  const [y, w] = key.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (w - 1) * 7);
  monday.setUTCHours(12);
  return monday;
}
export function addWeeks(key, n) {
  const d = weekStart(key);
  d.setUTCDate(d.getUTCDate() + 7 * n);
  return isoWeek(d);
}
export function weeksBetween(a, b) {
  const out = [];
  let k = a;
  for (let i = 0; i < 1000 && k <= b; i++) { out.push(k); k = addWeeks(k, 1); }
  return out;
}
