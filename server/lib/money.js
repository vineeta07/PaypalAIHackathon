// Integer-cent helpers. Money is never a float inside FairLoop.
export function toCents(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Invalid amount');
    return Math.round(value * 100);
  }
  const s = String(value).trim().replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`Invalid amount: ${value}`);
  const [whole, frac = ''] = s.split('.');
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2));
}
export function centsToValue(cents) {
  if (!Number.isInteger(cents)) throw new Error('cents must be an integer');
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
export function fmt(cents) {
  const [w, f] = centsToValue(Math.abs(cents)).split('.');
  return `${cents < 0 ? '-' : ''}$${Number(w).toLocaleString('en-US')}.${f}`;
}
/** Share in basis points (1500 = 15%), rounded down so the borrower is never over-charged. */
export function applyBps(cents, bps) {
  return Math.floor((cents * bps) / 10000);
}
