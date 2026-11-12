import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../server/lib/engine.js';
import { addWeeks } from '../server/lib/time.js';

const W = '2026-W10';
const terms = (o = {}) => ({ principal_cents: 30000, currency: 'USD', tiers: [{ min_weekly_cents: 3000, share_bps: 1500, label: 'normal' }, { min_weekly_cents: 10000, share_bps: 2000, label: 'good' }], weekly_min_income_cents: 3000, weekly_cap_cents: 2500, term_weeks: 52, end_of_term_action: 'review', fallback_weekly_cents: 500, declared_weekly_income_cents: 8000, ...o });
const loanOf = (o) => { let a = E.newAgreement(terms(o)); a = E.approve(a, 'lender'); a = E.approve(a, 'borrower'); return E.newLoanState(a, W); };
const pay = (loan, id, amt, week = W) => E.processPayment(loan, { capture_id: id, amount_cents: amt, week, lenderName: 'Maya' });

test('tiers pick share by week total', () => {
  const t = E.validateTerms(terms()).terms;
  assert.equal(E.tierFor(t, 2999).share_bps, 0);
  assert.equal(E.tierFor(t, 5000).share_bps, 1500);
  assert.equal(E.tierFor(t, 12000).share_bps, 2000);
});
test('normal deduction with reason string', () => {
  const { decision } = pay(loanOf(), 'c1', 4000);
  assert.equal(decision.lender_cents, 600);
  assert.equal(decision.borrower_cents, 3400);
  assert.match(decision.reason, /15% of \$40\.00 = \$6\.00 → \$6\.00 to Maya/);
});
test('weekly minimum crossing mid-week deducts only from the crossing payment on', () => {
  let loan = loanOf();
  let r = pay(loan, 'a', 1200); loan = r.loan;
  assert.equal(r.decision.lender_cents, 0); assert.match(r.decision.reason, /Skipped: below weekly minimum/);
  r = pay(loan, 'b', 1200); loan = r.loan; assert.equal(r.decision.lender_cents, 0);
  r = pay(loan, 'c', 1000); loan = r.loan; // week total 3400 >= 3000
  assert.equal(r.decision.lender_cents, 150);
  assert.equal(loan.repaid_cents, 150, 'earlier payments never deducted retroactively');
});
test('weekly cap limits deductions', () => {
  let loan = loanOf();
  let total = 0;
  for (let i = 0; i < 5; i++) { const r = pay(loan, `p${i}`, 4000); loan = r.loan; total += r.decision.lender_cents; }
  assert.equal(total, 2500);
  assert.equal(loan.weeks[W].deducted_cents, 2500);
});
test('final payment is capped at remaining balance and loan stops', () => {
  let loan = loanOf({ principal_cents: 1000, weekly_cap_cents: 100000 });
  let r = pay(loan, 'x', 4000); loan = r.loan; // 600
  r = pay(loan, 'y', 4000); loan = r.loan; // would be 600, only 400 left
  assert.equal(r.decision.lender_cents, 400);
  assert.equal(loan.status, 'repaid');
  assert.equal(loan.repaid_cents, 1000);
  r = pay(loan, 'z', 4000);
  assert.equal(r.decision.lender_cents, 0);
});
test('pause skips deductions', () => {
  const loan = loanOf({ paused_until: addWeeks(W, 1) });
  assert.equal(pay(loan, 'p', 8000).decision.lender_cents, 0);
  assert.equal(pay(loan, 'q', 8000, addWeeks(W, 2)).decision.lender_cents > 0, true);
});
test('4 consecutive low weeks trigger a review', () => {
  let loan = loanOf();
  assert.equal(E.needsReview(loan, addWeeks(W, 3)).due, false);
  assert.equal(E.needsReview(loan, addWeeks(W, 4)).due, true);
  loan = pay(loan, 'ok', 5000, addWeeks(W, 2)).loan;
  assert.equal(E.needsReview(loan, addWeeks(W, 4)).due, false);
});
test('idempotent on capture id', () => {
  let loan = loanOf();
  loan = pay(loan, 'same', 4000).loan;
  const r = pay(loan, 'same', 4000);
  assert.equal(r.decision.duplicate, true);
  assert.equal(r.loan.repaid_cents, 600);
  assert.equal(r.loan.weeks[W].income_cents, 4000);
});
test('agreement needs both approvals', () => {
  let a = E.newAgreement(terms());
  a = E.approve(a, 'lender'); assert.equal(a.active, false);
  a = E.approve(a, 'borrower'); assert.equal(a.active, true);
  assert.equal(a.terms_hash.length, 64);
  assert.throws(() => E.approve(a, 'customer'));
});
test('edits reset both approvals and change the hash', () => {
  let a = E.approve(E.approve(E.newAgreement(terms()), 'lender'), 'borrower');
  const h = a.terms_hash;
  a = E.proposeEdit(a, { term_weeks: 40 }, 'lender');
  assert.deepEqual(a.approvals, { lender: null, borrower: null });
  assert.equal(a.active, false);
  assert.notEqual(a.terms_hash, h);
});
test('validation clamps AI output into safe bounds', () => {
  const { terms: t, notes } = E.validateTerms(terms({ term_weeks: 300, tiers: [{ min_weekly_cents: 0, share_bps: 9000 }] }));
  assert.equal(t.term_weeks, 104);
  assert.equal(t.tiers[0].share_bps, 3000);
  assert.ok(notes.length >= 2);
});
test('hardship cannot increase burden without borrower approval', () => {
  const loan = loanOf();
  const harsh = E.decideHardship(loan, { type: 'fixed_amount', amount_cents: 9000 }, { lenderApproved: true, borrowerApproved: false, currentWeek: W });
  assert.equal(harsh.applied, false); assert.match(harsh.reason, /harsher/);
  const harshShare = E.decideHardship(loan, { type: 'reduce_share', share_bps: 2900 }, { lenderApproved: true, borrowerApproved: false, currentWeek: W });
  assert.equal(harshShare.applied, true, 'reduce_share can only lower (min with existing)');
  assert.equal(Math.max(...harshShare.loan.terms.tiers.map((x) => x.share_bps)), 2000);
  const gentle = E.decideHardship(loan, { type: 'pause', weeks: 2 }, { lenderApproved: true, borrowerApproved: false, currentWeek: W });
  assert.equal(gentle.applied, true);
  assert.equal(gentle.loan.terms.paused_until, addWeeks(W, 1));
  const noLender = E.decideHardship(loan, { type: 'pause', weeks: 2 }, { lenderApproved: false, borrowerApproved: true, currentWeek: W });
  assert.equal(noLender.applied, false);
  assert.equal(E.isHarsher(loan.terms, { ...loan.terms, term_weeks: 10 }).harsher, true);
});
test('end of term applies forgive_remaining', () => {
  const loan = loanOf({ term_weeks: 4, end_of_term_action: 'forgive_remaining' });
  const r = E.endOfTerm(loan, addWeeks(W, 4));
  assert.equal(r.loan.status, 'forgiven'); assert.equal(r.loan.forgiven_cents, 30000);
  assert.equal(E.endOfTerm(loanOf({ term_weeks: 4 }), addWeeks(W, 4)).loan.status, 'review');
});
test('fallback: activates after 3 zero weeks, not when paused, suspends when income returns, cancels on payoff', () => {
  let loan = loanOf();
  assert.equal(E.fallbackDecision(loan, addWeeks(W, 2)).action, 'suspend');
  assert.equal(E.fallbackDecision(loan, addWeeks(W, 3)).action, 'activate');
  assert.equal(E.fallbackDecision(loanOf({ paused_until: addWeeks(W, 3) }), addWeeks(W, 3)).action, 'suspend');
  const back = pay(loan, 'back', 5000, addWeeks(W, 3)).loan;
  assert.equal(E.fallbackDecision(back, addWeeks(W, 3)).action, 'suspend');
  // under 25% of declared ($80 → $20) for 3 weeks
  let low = loanOf();
  for (let i = 0; i < 3; i++) low = pay(low, `l${i}`, 1000, addWeeks(W, i)).loan;
  assert.equal(E.fallbackDecision(low, addWeeks(W, 3)).action, 'activate');
  const paid = { ...loan, status: 'repaid' };
  assert.equal(E.fallbackDecision(paid, addWeeks(W, 5)).action, 'cancel');
});
test('direct repayment is idempotent and capped', () => {
  let loan = loanOf({ principal_cents: 700 });
  let r = E.applyDirectRepayment(loan, { ref: 'f1', amount_cents: 500 }); loan = r.loan;
  r = E.applyDirectRepayment(loan, { ref: 'f1', amount_cents: 500 }); assert.equal(r.duplicate, true);
  r = E.applyDirectRepayment(loan, { ref: 'f2', amount_cents: 500 }); assert.equal(r.taken, 200); assert.equal(r.loan.status, 'repaid');
});
test('projection reports payoff weeks', () => {
  const p = E.projectPayoff(E.validateTerms(terms()).terms, [8000, 4000]);
  assert.ok(p.weeks > 0 && p.weeks < 104);
});
