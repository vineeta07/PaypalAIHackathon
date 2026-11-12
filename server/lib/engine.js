// FairLoop repayment rule engine. Deterministic, pure, integer cents.
// The AI never calls into this module to move money: it only proposes terms
// that humans approve; this code decides every deduction.
import crypto from 'node:crypto';
import { applyBps, fmt } from './money.js';
import { addWeeks, weeksBetween } from './time.js';

export const LIMITS = {
  maxShareBps: 3000, // 30%
  minTermWeeks: 4,
  maxTermWeeks: 104,
  maxPrincipalCents: 500000, // $5,000 demo ceiling for community loans
};

export const REVIEW_LOW_WEEKS = 4;
export const FALLBACK_LOW_WEEKS = 3;

export function canonicalTerms(t) {
  const keys = ['principal_cents', 'currency', 'tiers', 'weekly_min_income_cents', 'weekly_cap_cents',
    'term_weeks', 'end_of_term_action', 'paused_until', 'fallback_weekly_cents', 'declared_weekly_income_cents'];
  const o = {};
  for (const k of keys) o[k] = t[k] ?? null;
  o.tiers = [...(t.tiers || [])].map((x) => ({ min_weekly_cents: x.min_weekly_cents, share_bps: x.share_bps }))
    .sort((a, b) => a.min_weekly_cents - b.min_weekly_cents);
  return JSON.stringify(o);
}
export function hashTerms(t) {
  return crypto.createHash('sha256').update(canonicalTerms(t)).digest('hex');
}

/** Validate terms; returns {terms, notes}. Clamps into safe bounds, never throws on soft issues. */
export function validateTerms(input) {
  const notes = [];
  const t = structuredClone(input);
  const int = (v, d = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : d);
  t.currency = 'USD';
  t.principal_cents = int(t.principal_cents);
  if (t.principal_cents <= 0) throw new Error('Loan amount must be greater than $0.');
  if (t.principal_cents > LIMITS.maxPrincipalCents) {
    notes.push(`Amount clamped to ${fmt(LIMITS.maxPrincipalCents)} (community-loan ceiling).`);
    t.principal_cents = LIMITS.maxPrincipalCents;
  }
  t.weekly_min_income_cents = Math.max(0, int(t.weekly_min_income_cents));
  t.weekly_cap_cents = Math.max(0, int(t.weekly_cap_cents));
  if (t.weekly_cap_cents === 0) { t.weekly_cap_cents = t.principal_cents; notes.push('No weekly cap given; cap set to the full amount.'); }
  let term = int(t.term_weeks, 26);
  if (term < LIMITS.minTermWeeks || term > LIMITS.maxTermWeeks) {
    const c = Math.min(LIMITS.maxTermWeeks, Math.max(LIMITS.minTermWeeks, term));
    notes.push(`Term ${term} weeks is outside 4–104; set to ${c}.`);
    term = c;
  }
  t.term_weeks = term;
  if (!['review', 'forgive_remaining'].includes(t.end_of_term_action)) t.end_of_term_action = 'review';
  t.paused_until = t.paused_until || null;
  t.fallback_weekly_cents = Math.max(0, int(t.fallback_weekly_cents, 500));
  t.declared_weekly_income_cents = Math.max(0, int(t.declared_weekly_income_cents));
  let tiers = Array.isArray(t.tiers) ? t.tiers : [];
  tiers = tiers.map((x) => {
    let bps = int(x.share_bps);
    if (bps < 0 || bps > LIMITS.maxShareBps) {
      const c = Math.min(LIMITS.maxShareBps, Math.max(0, bps));
      notes.push(`Share ${bps / 100}% is outside 0–30%; set to ${c / 100}%.`);
      bps = c;
    }
    return { min_weekly_cents: Math.max(0, int(x.min_weekly_cents)), share_bps: bps, label: x.label || '' };
  }).sort((a, b) => a.min_weekly_cents - b.min_weekly_cents);
  if (!tiers.length) tiers = [{ min_weekly_cents: t.weekly_min_income_cents, share_bps: 1500, label: 'normal' }];
  t.tiers = tiers;
  return { terms: t, notes };
}

export function tierFor(terms, weekTotal) {
  if (weekTotal < terms.weekly_min_income_cents) return { share_bps: 0, label: 'below minimum' };
  let pick = { share_bps: 0, label: 'below minimum' };
  for (const tier of terms.tiers) if (weekTotal >= tier.min_weekly_cents) pick = tier;
  return pick;
}

export function isPaused(terms, week) {
  return !!terms.paused_until && week <= terms.paused_until;
}

// ---------- Agreement lifecycle ----------
export function newAgreement(terms, { now = new Date().toISOString() } = {}) {
  const { terms: t, notes } = validateTerms(terms);
  return { terms: t, notes, terms_hash: hashTerms(t), approvals: { lender: null, borrower: null }, version: 1, updated_at: now, active: false };
}
export function approve(agreement, role, { now = new Date().toISOString() } = {}) {
  if (!['lender', 'borrower'].includes(role)) throw new Error('Only the lender or borrower can approve.');
  const a = structuredClone(agreement);
  a.approvals[role] = { at: now, hash: a.terms_hash };
  a.active = !!(a.approvals.lender && a.approvals.borrower && a.approvals.lender.hash === a.terms_hash && a.approvals.borrower.hash === a.terms_hash);
  return a;
}
export function proposeEdit(agreement, changes, role, { now = new Date().toISOString() } = {}) {
  if (!['lender', 'borrower'].includes(role)) throw new Error('Only the lender or borrower can propose changes.');
  const a = structuredClone(agreement);
  const { terms, notes } = validateTerms({ ...a.terms, ...changes });
  a.terms = terms;
  a.notes = notes;
  a.terms_hash = hashTerms(terms);
  a.approvals = { lender: null, borrower: null }; // any edit resets both approvals
  a.active = false;
  a.version += 1;
  a.updated_at = now;
  a.last_edit_by = role;
  return a;
}

// ---------- Loan state ----------
export function newLoanState(agreement, startWeek) {
  return {
    terms: structuredClone(agreement.terms),
    terms_hash: agreement.terms_hash,
    start_week: startWeek,
    repaid_cents: 0,
    status: 'active', // active | repaid | review | forgiven
    processed: {}, // capture_id -> decision
    weeks: {}, // week -> {income_cents, deducted_cents, payments}
  };
}
export function remaining(loan) { return Math.max(0, loan.terms.principal_cents - loan.repaid_cents); }

/**
 * Process one captured customer payment. Returns {loan, decision}. Idempotent on capture_id.
 * Week total includes this payment. Below the minimum nothing is taken; when a later payment
 * pushes the week over the minimum, deductions apply from that payment onward (never retroactive).
 */
export function processPayment(loanIn, { capture_id, amount_cents, week, lenderName = 'Lender' }) {
  if (!capture_id) throw new Error('capture_id required');
  if (!Number.isInteger(amount_cents) || amount_cents <= 0) throw new Error('amount_cents must be a positive integer');
  if (loanIn.processed[capture_id]) return { loan: loanIn, decision: { ...loanIn.processed[capture_id], duplicate: true } };
  const loan = structuredClone(loanIn);
  const w = (loan.weeks[week] ||= { income_cents: 0, deducted_cents: 0, payments: 0 });
  w.income_cents += amount_cents;
  w.payments += 1;
  const t = loan.terms;
  const base = { capture_id, week, amount_cents, week_total_cents: w.income_cents, lender_cents: 0, borrower_cents: amount_cents, share_bps: 0, tier: '', skipped: false, reason: '' };
  let d;
  if (loan.status !== 'active') {
    d = { ...base, skipped: true, kind: 'not_active', reason: loan.status === 'repaid' ? 'Loan already repaid: the full payment goes to the borrower.' : `Loan is ${loan.status}: no deduction.` };
  } else if (isPaused(t, week)) {
    d = { ...base, skipped: true, kind: 'paused', reason: `Paused until ${t.paused_until} (hardship): nothing taken. Week total ${fmt(w.income_cents)}.` };
  } else if (w.income_cents < t.weekly_min_income_cents) {
    d = { ...base, skipped: true, kind: 'below_min', reason: `Skipped: below weekly minimum. Week total ${fmt(w.income_cents)} < ${fmt(t.weekly_min_income_cents)} minimum.` };
  } else {
    const tier = tierFor(t, w.income_cents);
    const raw = applyBps(amount_cents, tier.share_bps);
    const capLeft = Math.max(0, t.weekly_cap_cents - w.deducted_cents);
    const balLeft = remaining(loan);
    const take = Math.min(raw, capLeft, balLeft);
    let why = `${tier.share_bps / 100}% of ${fmt(amount_cents)} = ${fmt(raw)}`;
    if (take < raw && take === balLeft) why += `, capped at remaining balance ${fmt(balLeft)}`;
    else if (take < raw) why += `, capped by weekly cap (${fmt(capLeft)} left of ${fmt(t.weekly_cap_cents)})`;
    d = { ...base, kind: take > 0 ? 'deducted' : 'cap_reached', share_bps: tier.share_bps, tier: tier.label || '', lender_cents: take, borrower_cents: amount_cents - take,
      skipped: take === 0,
      reason: `${why} → ${fmt(take)} to ${lenderName}. Week total ${fmt(w.income_cents)}, ${tier.label || 'tier'} tier.` };
    w.deducted_cents += take;
    loan.repaid_cents += take;
    if (remaining(loan) === 0) { loan.status = 'repaid'; d.paid_off = true; d.reason += ' Loan fully repaid!'; }
  }
  loan.processed[capture_id] = d;
  return { loan, decision: d };
}

/** Completed weeks since start (excluding current), with income. */
export function weekHistory(loan, currentWeek) {
  const last = addWeeks(currentWeek, -1);
  if (last < loan.start_week) return [];
  return weeksBetween(loan.start_week, last).map((k) => ({ week: k, income_cents: loan.weeks[k]?.income_cents || 0, paused: isPaused(loan.terms, k) }));
}

function trailing(hist, pred) {
  let n = 0;
  for (let i = hist.length - 1; i >= 0 && pred(hist[i]); i--) n++;
  return n;
}

/** 4 consecutive low weeks → review prompt (nothing changes until both approve). */
export function needsReview(loan, currentWeek) {
  if (loan.status !== 'active') return { due: false, low_weeks: 0 };
  const hist = weekHistory(loan, currentWeek);
  const n = trailing(hist, (h) => h.income_cents < loan.terms.weekly_min_income_cents);
  return { due: n >= REVIEW_LOW_WEEKS, low_weeks: n };
}

/** Diversion safeguard: decides whether the fallback subscription should be active. */
export function fallbackDecision(loan, currentWeek, { hardshipPauseActive = false } = {}) {
  if (loan.status === 'repaid' || loan.status === 'forgiven') return { action: 'cancel', reason: 'Loan closed: fallback subscription cancelled.' };
  const hist = weekHistory(loan, currentWeek);
  const declared = loan.terms.declared_weekly_income_cents || 0;
  const quarter = Math.floor(declared / 4);
  const zero = trailing(hist, (h) => h.income_cents === 0);
  const low = declared > 0 ? trailing(hist, (h) => h.income_cents < quarter) : 0;
  const paused = hardshipPauseActive || isPaused(loan.terms, currentWeek) || hist.slice(-FALLBACK_LOW_WEEKS).some((h) => h.paused);
  const lastWeek = hist[hist.length - 1];
  const currentIncome = loan.weeks[currentWeek]?.income_cents || 0;
  if (paused) return { action: 'suspend', reason: 'Hardship pause active: fallback stays suspended.', zero_weeks: zero, low_weeks: low };
  if (currentIncome > 0 && (zero >= FALLBACK_LOW_WEEKS || low >= FALLBACK_LOW_WEEKS) && currentIncome >= quarter) {
    return { action: 'suspend', reason: 'FairLoop income has returned: fallback suspended again.', zero_weeks: zero, low_weeks: low };
  }
  if (zero >= FALLBACK_LOW_WEEKS) return { action: 'activate', reason: `No FairLoop income for ${zero} weeks in a row: fallback of ${fmt(loan.terms.fallback_weekly_cents)}/week activated.`, zero_weeks: zero, low_weeks: low };
  if (low >= FALLBACK_LOW_WEEKS) return { action: 'activate', reason: `FairLoop income under 25% of the declared ${fmt(declared)}/week for ${low} weeks: fallback activated.`, zero_weeks: zero, low_weeks: low };
  void lastWeek;
  return { action: 'suspend', reason: 'FairLoop income normal: fallback stays suspended.', zero_weeks: zero, low_weeks: low };
}

/** End-of-term handling. */
export function endOfTerm(loanIn, currentWeek) {
  const endWeek = addWeeks(loanIn.start_week, loanIn.terms.term_weeks);
  if (loanIn.status !== 'active' || currentWeek < endWeek) return { loan: loanIn, changed: false };
  const loan = structuredClone(loanIn);
  if (loan.terms.end_of_term_action === 'forgive_remaining') {
    loan.forgiven_cents = remaining(loan);
    loan.status = 'forgiven';
    return { loan, changed: true, reason: `End of term: remaining ${fmt(loan.forgiven_cents)} forgiven as agreed.` };
  }
  loan.status = 'review';
  return { loan, changed: true, reason: 'End of term reached: both parties review the remaining balance.' };
}

// ---------- Hardship ----------
export const HARDSHIP_TYPES = ['pause', 'reduce_share', 'extend_term', 'fixed_amount', 'partial_forgiveness'];

export function applyHardship(terms, req, currentWeek, loan) {
  const t = structuredClone(terms);
  const out = { terms: t, forgive_cents: 0 };
  switch (req.type) {
    case 'pause': { const w = Math.min(8, Math.max(1, Math.round(req.weeks || 1))); t.paused_until = addWeeks(currentWeek, w - 1); break; }
    case 'reduce_share': { const bps = Math.max(0, Math.round(req.share_bps ?? 0)); t.tiers = t.tiers.map((x) => ({ ...x, share_bps: Math.min(x.share_bps, bps) })); break; }
    case 'extend_term': t.term_weeks = Math.min(104, t.term_weeks + Math.max(1, Math.round(req.weeks || 4))); break;
    case 'fixed_amount': t.weekly_cap_cents = Math.max(0, Math.round(req.amount_cents || 0)); break;
    case 'partial_forgiveness': out.forgive_cents = Math.min(Math.max(0, Math.round(req.amount_cents || 0)), loan ? remaining(loan) : t.principal_cents); break;
    default: throw new Error(`Unknown hardship type ${req.type}`);
  }
  return out;
}

/** True if new terms would increase the borrower's burden in any dimension. */
export function isHarsher(oldT, newT) {
  const reasons = [];
  if (newT.principal_cents > oldT.principal_cents) reasons.push('higher amount');
  if (newT.weekly_cap_cents > oldT.weekly_cap_cents) reasons.push('higher weekly cap');
  if (newT.weekly_min_income_cents < oldT.weekly_min_income_cents) reasons.push('lower income minimum');
  if (newT.term_weeks < oldT.term_weeks) reasons.push('shorter term');
  if ((newT.fallback_weekly_cents || 0) > (oldT.fallback_weekly_cents || 0)) reasons.push('higher fallback');
  if (oldT.end_of_term_action === 'forgive_remaining' && newT.end_of_term_action !== 'forgive_remaining') reasons.push('no longer forgives at end');
  const maxOld = Math.max(0, ...oldT.tiers.map((x) => x.share_bps));
  const maxNew = Math.max(0, ...newT.tiers.map((x) => x.share_bps));
  const probe = [0, ...oldT.tiers.map((x) => x.min_weekly_cents), ...newT.tiers.map((x) => x.min_weekly_cents), 10_000_000];
  if (maxNew > maxOld || probe.some((p) => tierFor(newT, p).share_bps > tierFor(oldT, p).share_bps)) reasons.push('higher repayment share');
  return { harsher: reasons.length > 0, reasons };
}

/**
 * Decide a hardship request. Lender must approve; if the change would increase the borrower's
 * burden the borrower must approve as well. Terms can never get harsher automatically.
 */
export function decideHardship(loanIn, request, { lenderApproved, borrowerApproved, currentWeek }) {
  if (!lenderApproved) return { loan: loanIn, applied: false, reason: 'Lender has not approved.' };
  const { terms, forgive_cents } = applyHardship(loanIn.terms, request, currentWeek, loanIn);
  const h = isHarsher(loanIn.terms, terms);
  if (h.harsher && !borrowerApproved) return { loan: loanIn, applied: false, reason: `Rejected: change is harsher for the borrower (${h.reasons.join(', ')}) and needs borrower approval.` };
  const loan = structuredClone(loanIn);
  loan.terms = terms;
  loan.terms_hash = hashTerms(terms);
  if (forgive_cents) {
    loan.forgiven_cents = (loan.forgiven_cents || 0) + forgive_cents;
    loan.terms.principal_cents -= forgive_cents;
    loan.terms_hash = hashTerms(loan.terms);
    if (remaining(loan) === 0) loan.status = 'repaid';
  }
  return { loan, applied: true, reason: 'Hardship change applied.' };
}

// ---------- Affordability (deterministic projection) ----------
export function projectPayoff(terms, incomeHistoryCents, maxWeeks = 156) {
  if (!incomeHistoryCents.length) return { weeks: null, series: [] };
  let bal = terms.principal_cents;
  const series = [{ week: 0, balance_cents: bal }];
  for (let i = 1; i <= maxWeeks && bal > 0; i++) {
    const inc = incomeHistoryCents[(i - 1) % incomeHistoryCents.length];
    if (inc < terms.weekly_min_income_cents) { series.push({ week: i, balance_cents: bal }); continue; }
    const tier = tierFor(terms, inc);
    const take = Math.min(applyBps(inc, tier.share_bps), terms.weekly_cap_cents, bal);
    bal -= take;
    series.push({ week: i, balance_cents: bal });
  }
  return { weeks: bal === 0 ? series.length - 1 : null, series };
}

/** Direct repayment (e.g. fallback subscription charge), idempotent by ref, capped at the balance. */
export function applyDirectRepayment(loanIn, { ref, amount_cents }) {
  if (loanIn.processed[ref]) return { loan: loanIn, taken: 0, duplicate: true };
  const loan = structuredClone(loanIn);
  const taken = loan.status === 'active' ? Math.min(amount_cents, remaining(loan)) : 0;
  loan.repaid_cents += taken;
  loan.processed[ref] = { kind: 'direct', lender_cents: taken };
  if (remaining(loan) === 0 && loan.status === 'active') loan.status = 'repaid';
  return { loan, taken };
}
