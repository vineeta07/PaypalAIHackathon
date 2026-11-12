import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import * as E from './lib/engine.js';
import { appendEvent, verifyChain } from './lib/ledger.js';
import { fmt } from './lib/money.js';
import { isoWeek, addWeeks } from './lib/time.js';
import { PayPalError } from './lib/paypal.js';
import { describeHardship, summarize } from './lib/ai.js';
import { summariesAll, normLang } from './lib/i18n.js';

export function createApp({ store, paypal, ai, config = {}, staticDir = null, now = () => new Date() }) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  const db = () => store.get();
  const currentWeek = () => addWeeks(isoWeek(now()), db().clock_offset_weeks || 0);
  const log = (ev) => { const e = appendEvent(db().ledger, ev); return e; };
  // key + vars let the client render the notification in the viewer's language; text is the English fallback.
  const notify = (to, text, key = null, vars = {}) => { db().notifications.unshift({ id: crypto.randomUUID(), to, text, key, vars, at: now().toISOString() }); db().notifications = db().notifications.slice(0, 30); };
  const lenderName = () => db().personas.lender.name;
  const bad = (status, message) => Object.assign(new Error(message), { status, expose: true });

  async function payout({ batch_id, subject, items, kind, ref }) {
    const res = await paypal.createPayout({ batch_id, subject, items });
    const rec = { payout_batch_id: res.payout_batch_id, batch_id, kind, ref, batch_status: res.batch_status, items: items.filter((i) => i.amount_cents > 0).map((i) => ({ sender_item_id: i.sender_item_id, receiver: i.receiver, amount_cents: i.amount_cents, status: 'PENDING', who: i.who })), created_at: now().toISOString() };
    db().payouts[res.payout_batch_id] = rec;
    return rec;
  }
  async function refreshPayout(id) {
    const rec = db().payouts[id];
    if (!rec) throw bad(404, 'Payout not found');
    const r = await paypal.getPayout(id);
    rec.batch_status = r.batch_status;
    for (const it of rec.items) { const m = r.items.find((x) => x.sender_item_id === it.sender_item_id); if (m) it.status = m.transaction_status; }
    store.save();
    return rec;
  }

  function preview() {
    const d = db();
    if (!d.loan || d.loan.status !== 'active') return null;
    const wk = currentWeek();
    const w = d.loan.weeks[wk] || { income_cents: 0, deducted_cents: 0 };
    const sample = d.products[0].price_cents;
    const { decision } = E.processPayment(d.loan, { capture_id: '__preview__', amount_cents: sample, week: wk, lenderName: lenderName() });
    return { week: wk, week_income_cents: w.income_cents, week_deducted_cents: w.deducted_cents, sample_cents: sample, decision };
  }

  function view() {
    const d = db();
    const wk = currentWeek();
    return {
      config: { paypal_mode: paypal.mode, paypal_client_id: paypal.mode === 'sandbox' ? config.paypalClientId : null, ai: ai.enabled ? 'gemini' : 'offline', ai_model: ai.model },
      week: wk,
      personas: d.personas, products: d.products, income_history: d.income_history,
      request: d.request, agreement: d.agreement,
      loan: d.loan ? { ...d.loan, processed: undefined, remaining_cents: E.remaining(d.loan), end_week: addWeeks(d.loan.start_week, d.loan.terms.term_weeks) } : null,
      funding: d.funding, payments: d.payments.slice(-50).reverse(), payouts: Object.values(d.payouts).slice(-30).reverse(),
      hardships: d.hardships.slice().reverse(), review: d.review, fallback: d.fallback, notifications: d.notifications,
      preview: preview(), ledger_count: d.ledger.length,
    };
  }

  async function weeklyChecks(lang = 'en') {
    const d = db();
    if (!d.loan) return;
    const wk = currentWeek();
    // end of term
    const eot = E.endOfTerm(d.loan, wk);
    if (eot.changed) { d.loan = eot.loan; log({ type: 'end_of_term', summary: eot.reason }); notify('both', eot.reason, eot.loan.status === 'forgiven' ? 'endForgive' : 'endReview', { amount_cents: eot.loan.forgiven_cents || 0 }); }
    // 4-week low income review
    const rv = E.needsReview(d.loan, wk);
    if (rv.due && (!d.review || d.review.status !== 'open')) {
      const opts = await ai.suggestReviewOptions({ low_weeks: rv.low_weeks, remaining: fmt(E.remaining(d.loan)), terms: d.loan.terms });
      d.review = { status: 'open', low_weeks: rv.low_weeks, options: opts.options, ai: opts.ai, approvals: { lender: null, borrower: null }, opened_at: now().toISOString() };
      log({ type: 'review_prompt', summary: `${rv.low_weeks} low-income weeks in a row: review suggested (nothing changes until both approve).` });
      notify('both', 'Four low weeks in a row. FairLoop suggested some gentler options: have a look together.', 'review', { n: rv.low_weeks });
    }
    // diversion safeguard
    await fallbackCheck(lang);
  }

  async function fallbackCheck(lang = 'en') {
    const d = db();
    const fb = d.fallback;
    if (!d.loan || !fb.subscription_id || fb.status === 'CANCELLED') return;
    const wk = currentWeek();
    const pauseActive = E.isPaused(d.loan.terms, wk);
    const dec = E.fallbackDecision(d.loan, wk, { hardshipPauseActive: pauseActive });
    fb.last_check = { week: wk, ...dec };
    if (dec.action === 'cancel') {
      await paypal.cancelSubscription(fb.subscription_id, 'Loan repaid');
      fb.status = 'CANCELLED';
      log({ type: 'fallback_cancelled', summary: 'Loan closed: fallback subscription cancelled.', ref: fb.subscription_id });
    } else if (dec.action === 'activate' && fb.status !== 'ACTIVE') {
      const msg = await ai.checkInMessage({ borrower: d.personas.borrower.name, lender: lenderName(), fallback_cents: d.loan.terms.fallback_weekly_cents, weeks: dec.zero_weeks || dec.low_weeks, lang });
      fb.message = msg.message;
      fb.message_lang = normLang(lang);
      notify('both', msg.message, 'fallbackOn', { amount_cents: d.loan.terms.fallback_weekly_cents });
      await paypal.activateSubscription(fb.subscription_id, 'FairLoop income stopped');
      fb.status = 'ACTIVE';
      fb.activated_week = wk;
      log({ type: 'fallback_activated', summary: dec.reason, ref: fb.subscription_id, status: 'warn' });
    } else if (dec.action === 'suspend' && fb.status === 'ACTIVE') {
      await paypal.suspendSubscription(fb.subscription_id, 'FairLoop income returned');
      fb.status = 'SUSPENDED';
      log({ type: 'fallback_suspended', summary: dec.reason, ref: fb.subscription_id });
      notify('both', 'Sales are back, so the fallback payment is paused again.', 'fallbackOff');
    }
  }

  async function settlePayment({ capture_id, order_id, amount_cents, product, simulated = false }) {
    const d = db();
    const wk = currentWeek();
    if (d.payments.some((p) => p.capture_id === capture_id)) return d.payments.find((p) => p.capture_id === capture_id);
    let decision;
    if (d.loan) {
      const r = E.processPayment(d.loan, { capture_id, amount_cents, week: wk, lenderName: lenderName() });
      d.loan = r.loan; decision = r.decision;
    } else {
      decision = { capture_id, week: wk, amount_cents, lender_cents: 0, borrower_cents: amount_cents, skipped: true, kind: 'no_loan', reason: 'No active loan: the full payment goes to Ravi.' };
    }
    const rec = { capture_id, order_id, amount_cents, product: product?.name || 'Order', week: wk, decision, simulated, at: now().toISOString() };
    d.payments.push(rec);
    log({ type: 'payment', actor: 'customer', summary: `${fmt(amount_cents)} for ${rec.product}${simulated ? ' (simulated week)' : ''}`, amount_cents, ref: capture_id });
    log({ type: decision.lender_cents > 0 ? 'split' : 'skip', summary: decision.reason, amount_cents: decision.lender_cents, ref: capture_id, status: decision.lender_cents > 0 ? 'ok' : 'info' });
    const p = await payout({ batch_id: `FL-${capture_id}`.slice(0, 127), subject: 'FairLoop payment', kind: 'split', ref: capture_id, items: [
      { who: 'lender', receiver: d.personas.lender.email, amount_cents: decision.lender_cents, note: `FairLoop repayment from ${d.personas.borrower.name}: ${decision.reason}`, sender_item_id: `${capture_id}-LENDER`.slice(0, 63) },
      { who: 'borrower', receiver: d.personas.borrower.email, amount_cents: decision.borrower_cents, note: `Your earnings for ${rec.product} via FairLoop.`, sender_item_id: `${capture_id}-BORROWER`.slice(0, 63) },
    ] });
    rec.payout_batch_id = p.payout_batch_id;
    if (decision.paid_off) await onPaidOff();
    else await fallbackCheck();
    store.save();
    return rec;
  }

  async function onPaidOff() {
    const d = db();
    log({ type: 'payoff', summary: `Loan repaid 🎉 ${fmt(d.loan.terms.principal_cents)} returned to ${lenderName()}. Deductions stopped.`, amount_cents: d.loan.terms.principal_cents });
    notify('both', `Loan repaid 🎉 Ravi has paid back ${fmt(d.loan.terms.principal_cents)} in full.`, 'paidOff', { amount_cents: d.loan.terms.principal_cents });
    d.loan.repaid_at = now().toISOString();
    await fallbackCheck();
  }

  const h = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

  // ---------- routes ----------
  app.get('/api/health', (req, res) => res.json({ ok: true, paypal: paypal.mode, ai: ai.enabled ? 'gemini' : 'offline' }));
  app.get('/api/state', (req, res) => res.json(view()));
  app.post('/api/reset', h(async (req, res) => { store.reset(); log({ type: 'reset', summary: 'Demo reset and reseeded.' }); store.save(); res.json(view()); }));

  app.post('/api/loan/request', h(async (req, res) => {
    const text = String(req.body?.text || '').trim();
    if (!text) throw bad(400, 'Please describe what you need.');
    if (db().loan) throw bad(409, 'There is already a loan in progress. Reset the demo to start over.');
    const lang = normLang(req.body?.lang);
    const plan = await ai.planLoan(text, db().income_history, lang);
    db().request = { text, at: now().toISOString(), ...plan, terms: undefined };
    if (plan.terms) {
      db().agreement = E.newAgreement(plan.terms, { now: now().toISOString() });
      db().agreement.summary = plan.summary;
      db().agreement.summary_lang = plan.summary_lang || lang;
      db().agreement.summaries = summariesAll(db().agreement.terms);
      db().agreement.ai_notes = plan.notes;
      log({ type: 'agreement_drafted', actor: plan.ai === 'gemini' ? 'ai' : 'rules', summary: `Draft agreement for ${fmt(plan.terms.principal_cents)} (hash ${db().agreement.terms_hash.slice(0, 10)}…)`, amount_cents: plan.terms.principal_cents });
    }
    store.save();
    res.json(view());
  }));

  app.post('/api/agreement/approve', h(async (req, res) => {
    const role = req.body?.role;
    const d = db();
    if (!d.agreement) throw bad(404, 'No agreement to approve yet.');
    if (d.loan) throw bad(409, 'This agreement is already in effect.');
    d.agreement = E.approve(d.agreement, role, { now: now().toISOString() });
    log({ type: 'approval', actor: role, summary: `${d.personas[role].name} approved terms ${d.agreement.terms_hash.slice(0, 10)}…` });
    if (d.agreement.active) {
      log({ type: 'agreement_active', summary: 'Both approved: agreement is active. Next: borrower sets up the fallback, lender funds the loan.' });
      if (d.fallback.status === 'not_set_up') d.fallback = { status: 'approval_needed' };
    }
    store.save(); res.json(view());
  }));

  app.post('/api/agreement/edit', h(async (req, res) => {
    const { role, changes = {} } = req.body || {};
    const d = db();
    if (!d.agreement) throw bad(404, 'No agreement yet.');
    if (d.loan) throw bad(409, 'The loan is already funded; use a hardship request instead.');
    const allowed = ['principal_cents', 'weekly_min_income_cents', 'weekly_cap_cents', 'term_weeks', 'end_of_term_action', 'fallback_weekly_cents', 'tiers'];
    const clean = Object.fromEntries(Object.entries(changes).filter(([k]) => allowed.includes(k)));
    const summary = d.agreement.summary;
    d.agreement = E.proposeEdit(d.agreement, clean, role, { now: now().toISOString() });
    d.agreement.summary = summarize(d.agreement.terms) || summary;
    d.agreement.summary_lang = 'en';
    d.agreement.summaries = summariesAll(d.agreement.terms);
    d.agreement.affordability = ai.analyzeAffordability(d.agreement.terms, d.income_history);
    if (d.request) d.request.affordability = d.agreement.affordability;
    log({ type: 'agreement_edited', actor: role, summary: `${d.personas[role].name} proposed changes; both approvals reset (hash ${d.agreement.terms_hash.slice(0, 10)}…)` });
    store.save(); res.json(view());
  }));

  // Diversion safeguard: fallback subscription
  app.post('/api/fallback/plan', h(async (req, res) => {
    const d = db();
    if (!d.agreement?.active) throw bad(409, 'Both people need to approve the agreement first.');
    const amt = d.agreement.terms.fallback_weekly_cents;
    const plan = await paypal.createPlan({ amount_cents: amt, name: `FairLoop fallback ${fmt(amt)}/week` });
    d.fallback = { ...d.fallback, status: 'approval_needed', plan_id: plan.plan_id, amount_cents: amt };
    log({ type: 'fallback_plan', summary: `Fallback plan created: ${fmt(amt)}/week (only used if FairLoop sales stop).`, ref: plan.plan_id });
    let simSub = null;
    if (paypal.mode === 'simulated') simSub = (await paypal.createSimSubscription()).id;
    store.save(); res.json({ plan_id: plan.plan_id, sim_subscription_id: simSub, state: view() });
  }));
  app.post('/api/fallback/approved', h(async (req, res) => {
    const d = db();
    const id = String(req.body?.subscription_id || '');
    if (!id) throw bad(400, 'Missing subscription id.');
    await paypal.suspendSubscription(id, 'Standby: only used if FairLoop income stops');
    d.fallback = { ...d.fallback, subscription_id: id, status: 'SUSPENDED', approved_at: now().toISOString() };
    log({ type: 'fallback_ready', actor: 'borrower', summary: `Ravi approved the ${fmt(d.fallback.amount_cents || 500)}/week fallback; immediately suspended (standby).`, ref: id });
    store.save(); res.json(view());
  }));

  // Funding: lender pays via Orders v2, server disburses via Payouts
  app.post('/api/fund/order', h(async (req, res) => {
    const d = db();
    if (!d.agreement?.active) throw bad(409, 'Both people need to approve the agreement first.');
    if (!['SUSPENDED', 'ACTIVE'].includes(d.fallback.status)) throw bad(409, 'Ravi needs to set up the fallback safeguard first.');
    if (d.loan) throw bad(409, 'This loan is already funded.');
    const amt = d.agreement.terms.principal_cents;
    const o = await paypal.createOrder({ amount_cents: amt, description: `FairLoop interest-free loan to ${d.personas.borrower.name}`, custom_id: `LOAN-${d.agreement.terms_hash.slice(0, 16)}` });
    d.funding = { order_id: o.id, status: 'CREATED' };
    store.save(); res.json({ id: o.id });
  }));
  app.post('/api/fund/capture', h(async (req, res) => {
    const d = db();
    const orderId = String(req.body?.order_id || '');
    if (!d.funding || d.funding.order_id !== orderId) throw bad(400, 'Unknown funding order.');
    if (d.loan) return res.json(view());
    const cap = await paypal.captureOrder(orderId);
    if (cap.capture_status !== 'COMPLETED' && cap.capture_status !== 'PENDING') throw bad(402, `Payment not completed (${cap.capture_status}).`);
    d.funding = { ...d.funding, status: 'CAPTURED', capture_id: cap.capture_id, captured_at: now().toISOString() };
    d.loan = E.newLoanState(d.agreement, currentWeek());
    log({ type: 'funding', actor: 'lender', summary: `${lenderName()} funded ${fmt(d.loan.terms.principal_cents)} via PayPal (capture ${cap.capture_id}).`, amount_cents: d.loan.terms.principal_cents, ref: cap.capture_id });
    const p = await payout({ batch_id: `FL-DISB-${cap.capture_id}`.slice(0, 127), subject: 'Your FairLoop loan has arrived', kind: 'disbursement', ref: cap.capture_id, items: [
      { who: 'borrower', receiver: d.personas.borrower.email, amount_cents: d.loan.terms.principal_cents, note: `Interest-free loan from ${lenderName()} via FairLoop.`, sender_item_id: `DISB-${cap.capture_id}`.slice(0, 63) },
    ] });
    d.funding.payout_batch_id = p.payout_batch_id;
    log({ type: 'disbursement', summary: `${fmt(d.loan.terms.principal_cents)} sent to ${d.personas.borrower.name} via PayPal Payouts (batch ${p.payout_batch_id}).`, amount_cents: d.loan.terms.principal_cents, ref: p.payout_batch_id });
    notify('borrower', `${fmt(d.loan.terms.principal_cents)} from ${lenderName()} is on its way to your PayPal.`, 'funded', { amount_cents: d.loan.terms.principal_cents, lender: lenderName() });
    store.save(); res.json(view());
  }));

  // Customer pay page
  app.post('/api/pay/order', h(async (req, res) => {
    const d = db();
    const product = d.products.find((p) => p.id === req.body?.product_id);
    if (!product) throw bad(400, 'Please pick a product.');
    const o = await paypal.createOrder({ amount_cents: product.price_cents, description: `${product.name} from Ravi's kitchen`, custom_id: `PAY-ravi-${product.id}`, items: [{ name: product.name, quantity: 1, unit_amount_cents: product.price_cents }] });
    d.pending_orders = { ...(d.pending_orders || {}), [o.id]: product.id };
    store.save(); res.json({ id: o.id });
  }));
  app.post('/api/pay/capture', h(async (req, res) => {
    const d = db();
    const orderId = String(req.body?.order_id || '');
    const productId = d.pending_orders?.[orderId];
    if (!productId) throw bad(400, 'Unknown order.');
    const cap = await paypal.captureOrder(orderId);
    delete d.pending_orders[orderId];
    const product = d.products.find((p) => p.id === productId);
    const rec = await settlePayment({ capture_id: cap.capture_id, order_id: orderId, amount_cents: cap.amount_cents, product });
    res.json({ payment: rec, state: view() });
  }));

  // Demo-only time machine
  app.post('/api/simulate/week', h(async (req, res) => {
    const d = db();
    const mode = ['low', 'normal', 'zero', 'good'].includes(req.body?.mode) ? req.body.mode : 'low';
    const sets = { low: [900, 1200], normal: [4000, 1800, 1200, 900], good: [4000, 4000, 1800, 1800, 1200], zero: [] };
    const results = [];
    for (const amt of sets[mode]) {
      const product = d.products.find((p) => p.price_cents === amt);
      results.push(await settlePayment({ capture_id: `SIM-CAPTURE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, order_id: null, amount_cents: amt, product, simulated: true }));
    }
    // simulated fallback charge while the safeguard is active
    if (d.loan && d.fallback.status === 'ACTIVE') {
      const ref = `SIM-FALLBACK-${currentWeek()}`;
      const r = E.applyDirectRepayment(d.loan, { ref, amount_cents: d.loan.terms.fallback_weekly_cents });
      d.loan = r.loan;
      if (r.taken) log({ type: 'fallback_charge', summary: `Fallback subscription charged ${fmt(r.taken)} → ${lenderName()}.`, amount_cents: r.taken, ref });
      if (d.loan.status === 'repaid') await onPaidOff();
    }
    const wk = currentWeek();
    const income = d.loan?.weeks[wk]?.income_cents ?? results.reduce((s, r) => s + r.amount_cents, 0);
    log({ type: 'week_closed', summary: `Week ${wk} closed (simulated): income ${fmt(income)}.`, amount_cents: income });
    d.clock_offset_weeks += 1;
    await weeklyChecks(normLang(req.body?.lang));
    store.save(); res.json(view());
  }));

  // Hardship
  app.post('/api/hardship/request', h(async (req, res) => {
    const d = db();
    const text = String(req.body?.text || '').trim();
    if (!d.loan || d.loan.status !== 'active') throw bad(409, 'There is no active loan.');
    if (!text) throw bad(400, 'Tell Maya what is going on.');
    const parsed = await ai.parseHardship(text, normLang(req.body?.lang));
    const item = { id: crypto.randomUUID().slice(0, 8), text, request: parsed, status: 'pending', at: now().toISOString(), ai: parsed.ai };
    d.hardships.push(item);
    log({ type: 'hardship_request', actor: 'borrower', summary: `Hardship request: ${parsed.summary}` });
    notify('lender', `Ravi asked: ${parsed.summary}`, 'hardshipAsked', { req: parsed });
    store.save(); res.json(view());
  }));
  app.post('/api/hardship/:id/decide', h(async (req, res) => {
    const d = db();
    const item = d.hardships.find((x) => x.id === req.params.id);
    if (!item || item.status !== 'pending') throw bad(404, 'Request not found or already decided.');
    const { role, approve: ok } = req.body || {};
    if (role !== 'lender') throw bad(403, 'Only the lender decides a hardship request.');
    if (!ok) {
      item.status = 'denied';
      log({ type: 'hardship_denied', actor: 'lender', summary: `${lenderName()} declined: ${item.request.summary} Terms unchanged.` });
      notify('borrower', `${lenderName()} couldn't agree to that change this time. Terms stay the same.`, 'hardshipDenied', { lender: lenderName() });
    } else {
      const r = E.decideHardship(d.loan, item.request, { lenderApproved: true, borrowerApproved: true, currentWeek: currentWeek() });
      if (!r.applied) throw bad(409, r.reason);
      d.loan = r.loan;
      item.status = 'approved';
      log({ type: 'hardship_approved', actor: 'lender', summary: `${lenderName()} approved: ${describeHardship(item.request)} New terms hash ${d.loan.terms_hash.slice(0, 10)}…` });
      notify('borrower', `${lenderName()} approved: ${describeHardship(item.request)}`, 'hardshipApproved', { lender: lenderName(), req: item.request });
      if (d.loan.status === 'repaid') await onPaidOff(); else await fallbackCheck();
    }
    item.decided_at = now().toISOString();
    store.save(); res.json(view());
  }));

  // Review (4 low weeks): both must approve the same option
  app.post('/api/review/approve', h(async (req, res) => {
    const d = db();
    const { role, option } = req.body || {};
    if (!d.review || d.review.status !== 'open') throw bad(404, 'No open review.');
    if (!['lender', 'borrower'].includes(role)) throw bad(403, 'Only the lender or borrower can choose.');
    const idx = Number(option);
    if (!d.review.options[idx]) throw bad(400, 'Unknown option.');
    d.review.approvals[role] = idx;
    log({ type: 'review_vote', actor: role, summary: `${d.personas[role].name} chose: ${d.review.options[idx].summary}` });
    if (d.review.approvals.lender === idx && d.review.approvals.borrower === idx) {
      const r = E.decideHardship(d.loan, d.review.options[idx], { lenderApproved: true, borrowerApproved: true, currentWeek: currentWeek() });
      if (r.applied) { d.loan = r.loan; d.review.status = 'resolved'; log({ type: 'review_applied', summary: `Both agreed: ${describeHardship(d.review.options[idx])}` }); }
    }
    store.save(); res.json(view());
  }));

  app.post('/api/payouts/:id/refresh', h(async (req, res) => { const r = await refreshPayout(req.params.id); res.json(r); }));
  app.get('/api/ledger', (req, res) => res.json({ events: db().ledger, verify: verifyChain(db().ledger) }));
  app.get('/api/ledger/verify', (req, res) => res.json(verifyChain(db().ledger)));
  app.post('/api/ai/explain', h(async (req, res) => {
    const p = db().payments.find((x) => x.capture_id === req.body?.capture_id);
    if (!p) throw bad(404, 'Payment not found.');
    res.json(await ai.explainDeduction(p.decision, normLang(req.body?.lang)));
  }));

  app.post('/api/paypal/webhook', h(async (req, res) => {
    if (!config.webhookId || paypal.mode !== 'sandbox') return res.json({ ignored: true });
    const ok = await paypal.verifyWebhook({ headers: req.headers, event: req.body, webhookId: config.webhookId });
    if (!ok) return res.status(400).json({ error: 'invalid signature' });
    const ev = req.body;
    if (ev.event_type?.startsWith('PAYMENT.PAYOUTS-ITEM.')) {
      const it = ev.resource?.payout_item;
      for (const rec of Object.values(db().payouts)) for (const x of rec.items) if (x.sender_item_id === it?.sender_item_id) x.status = ev.resource.transaction_status;
    }
    log({ type: 'webhook', summary: `PayPal webhook ${ev.event_type}`, ref: ev.id });
    store.save(); res.json({ ok: true });
  }));

  if (staticDir && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }
  app.use('/api', (req, res) => res.status(404).json({ error: { message: 'Not found' } }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof PayPalError) return res.status(502).json({ error: { message: friendly(err), paypal: err.toJSON() } });
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: { message: err.expose ? err.message : (status === 400 ? 'Invalid request.' : 'Something went wrong. Please try again.') } });
  });
  return app;
}

function friendly(e) {
  const map = { INSTRUMENT_DECLINED: 'The card or PayPal balance was declined. Please try another payment method.', ORDER_ALREADY_CAPTURED: 'This order was already paid.', AUTHENTICATION_FAILURE: 'FairLoop could not sign in to PayPal. Check the sandbox keys.', INSUFFICIENT_FUNDS: 'The sandbox business account does not have enough balance to send this payout.' };
  return `${map[e.issue] || map[e.name_] || 'PayPal could not complete this step.'} (PayPal ${e.name_}${e.issue ? ` / ${e.issue}` : ''}${e.debug_id ? `, debug id ${e.debug_id}` : ''})`;
}
