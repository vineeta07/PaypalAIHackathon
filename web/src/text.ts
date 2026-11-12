// Renders structured engine/server data in the viewer's language.
import { fmt, pct, type Decision, type HardshipReq } from './api';
import type { Vars } from './i18n';

type T = (key: string, vars?: Vars, fallback?: string) => string;

export function hardshipLabel(t: T, h: HardshipReq, withReason = false): string {
  const base = t(`h.${h.type}`, { weeks: h.weeks ?? 0, pct: pct(h.share_bps ?? 0), amount: fmt(h.amount_cents ?? 0) }, h.summary);
  return withReason && h.reason ? `${base} ${t(`h.reason.${h.reason}`, {}, '')}`.trim() : base;
}

export function reasonText(t: T, d: Decision, lender: string): string {
  const total = fmt(d.week_total_cents ?? d.amount_cents);
  switch (d.kind) {
    case 'deducted': {
      const raw = d.raw_cents ?? d.lender_cents;
      let s = t('r.deducted', { pct: pct(d.share_bps), amount: fmt(d.amount_cents), raw: fmt(raw), take: fmt(d.lender_cents), lender, total, tier: t(`tier.${d.tier || 'normal'}`, {}, d.tier || '') });
      if (d.lender_cents < raw) s += d.paid_off ? t('r.cappedBal') : t('r.capped', { take: fmt(d.lender_cents) });
      if (d.paid_off) s += t('r.paidOff');
      return s;
    }
    case 'cap_reached': return t('r.cap_reached', { total });
    case 'below_min': return d.min_cents !== undefined ? t('r.below_min', { total, min: fmt(d.min_cents) }) : d.reason;
    case 'paused': return t('r.paused', { total });
    case 'not_active': return t('r.not_active');
    case 'no_loan': return t('r.no_loan');
    default: return d.reason;
  }
}

export function notificationText(t: T, n: { key?: string | null; vars?: Record<string, unknown>; text: string }): string {
  if (!n.key) return n.text;
  const v = n.vars || {};
  const vars: Vars = {};
  for (const [k, val] of Object.entries(v)) {
    if (k === 'amount_cents') vars.amount = fmt(Number(val));
    else if (k === 'req') vars.req = hardshipLabel(t, val as HardshipReq);
    else vars[k] = String(val);
  }
  return t(`n.${n.key}`, vars, n.text);
}
