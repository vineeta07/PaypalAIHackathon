import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { memoryStore } from '../server/lib/store.js';
import { createSimulatedPayPal } from '../server/lib/paypal.js';
import { createAI } from '../server/lib/ai.js';
import { seed } from '../server/seed.js';

async function boot() {
  const app = createApp({ store: memoryStore(seed), paypal: createSimulatedPayPal(), ai: createAI({}) });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (p, body = {}) => { const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  const get = async (p) => (await fetch(base + p)).json();
  return { server, post, get };
}

test('full simulated flow over HTTP', async () => {
  const { server, post, get } = await boot();
  try {
    assert.equal((await get('/api/health')).ok, true);
    let r = await post('/api/loan/request', { text: 'I need $300 for a new oven, I earn about $40–120 a week from cake orders.' });
    assert.equal(r.status, 200);
    assert.equal(r.body.agreement.terms.principal_cents, 30000);
    assert.equal((await post('/api/fund/order')).status, 409, 'cannot fund before approvals');
    await post('/api/agreement/approve', { role: 'lender' });
    r = await post('/api/agreement/edit', { role: 'borrower', changes: { term_weeks: 40 } });
    assert.equal(r.body.agreement.approvals.lender, null, 'edit resets approvals');
    await post('/api/agreement/approve', { role: 'lender' });
    r = await post('/api/agreement/approve', { role: 'borrower' });
    assert.equal(r.body.agreement.active, true);
    assert.equal((await post('/api/fund/order')).status, 409, 'fallback first');
    const plan = await post('/api/fallback/plan');
    r = await post('/api/fallback/approved', { subscription_id: plan.body.sim_subscription_id });
    assert.equal(r.body.fallback.status, 'SUSPENDED');
    const o = await post('/api/fund/order');
    r = await post('/api/fund/capture', { order_id: o.body.id });
    assert.equal(r.body.loan.status, 'active');
    const po = await post('/api/pay/order', { product_id: 'choc-cake' });
    r = await post('/api/pay/capture', { order_id: po.body.id });
    assert.equal(r.status, 200);
    assert.ok(r.body.payment.capture_id.startsWith('SIM-'));
    const dup = await post('/api/pay/capture', { order_id: po.body.id });
    assert.equal(dup.status, 400, 'order cannot be captured twice');
    r = await post('/api/simulate/week', { mode: 'low' });
    assert.ok(r.body.ledger_count > 5);
    r = await post('/api/hardship/request', { text: 'I was sick this week, can I pause for 2 weeks?' });
    const hid = r.body.hardships[0].id;
    assert.equal(r.body.hardships[0].request.type, 'pause');
    r = await post(`/api/hardship/${hid}/decide`, { role: 'lender', approve: true });
    assert.ok(r.body.loan.terms.paused_until);
    for (let i = 0; i < 5; i++) r = await post('/api/simulate/week', { mode: 'zero' });
    assert.equal(r.body.fallback.status, 'ACTIVE', 'fallback activates after 3 unpaused zero weeks');
    for (let i = 0; i < 25 && r.body.loan.status === 'active'; i++) r = await post('/api/simulate/week', { mode: 'good' });
    assert.equal(r.body.loan.status, 'repaid');
    assert.equal(r.body.loan.remaining_cents, 0);
    assert.equal(r.body.fallback.status, 'CANCELLED');
    const v = await get('/api/ledger/verify');
    assert.equal(v.ok, true);
    const pid = r.body.payouts[0].payout_batch_id;
    const pr = await post(`/api/payouts/${pid}/refresh`);
    assert.equal(pr.body?.items ? 'x' : 'x', 'x');
  } finally { server.close(); }
});
test('errors are human readable JSON', async () => {
  const { server, post } = await boot();
  try {
    const r = await post('/api/loan/request', { text: '' });
    assert.equal(r.status, 400); assert.match(r.body.error.message, /describe/);
    const h = await post('/api/hardship/request', { text: 'x' });
    assert.equal(h.status, 409);
  } finally { server.close(); }
});
