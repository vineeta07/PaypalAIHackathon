// Append-only, hash-chained event ledger.
import crypto from 'node:crypto';
const GENESIS = '0'.repeat(64);
function digest(e) {
  const { seq, type, at, actor, summary, amount_cents, ref, prev_hash } = e;
  return crypto.createHash('sha256').update(JSON.stringify({ seq, type, at, actor, summary, amount_cents, ref, prev_hash })).digest('hex');
}
export function appendEvent(ledger, { type, actor = 'system', summary, amount_cents = 0, ref = null, at = new Date().toISOString(), status = 'ok' }) {
  const prev = ledger[ledger.length - 1];
  const e = { seq: ledger.length + 1, type, at, actor, summary, amount_cents, ref, status, prev_hash: prev ? prev.hash : GENESIS };
  e.hash = digest(e);
  ledger.push(e);
  return e;
}
export function verifyChain(ledger) {
  let prev = GENESIS;
  for (const e of ledger) {
    if (e.prev_hash !== prev || digest(e) !== e.hash) return { ok: false, broken_at: e.seq, count: ledger.length };
    prev = e.hash;
  }
  return { ok: true, count: ledger.length, head: prev };
}
