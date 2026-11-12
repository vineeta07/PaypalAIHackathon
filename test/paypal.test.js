import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPayPalClient, buildPayoutBody, buildOrderBody, PayPalError } from '../server/lib/paypal.js';

function mockFetch(handlers) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const path = new URL(url).pathname;
    const h = handlers[path] || handlers['*'];
    const [status, body] = h(init);
    return { ok: status < 300, status, json: async () => body };
  };
  fn.calls = calls;
  return fn;
}
const token = () => [200, { access_token: 'T', expires_in: 3600 }];

test('token is cached across calls and POSTs carry PayPal-Request-Id', async () => {
  const f = mockFetch({ '/v1/oauth2/token': token, '/v2/checkout/orders': () => [201, { id: 'O1', status: 'CREATED' }] });
  const pp = createPayPalClient({ clientId: 'a', clientSecret: 'b', fetchImpl: f });
  await pp.createOrder({ amount_cents: 4000, description: 'Cake', custom_id: 'X' });
  await pp.createOrder({ amount_cents: 4000, description: 'Cake', custom_id: 'X' });
  assert.equal(f.calls.filter((c) => c.url.endsWith('/v1/oauth2/token')).length, 1);
  const orders = f.calls.filter((c) => c.url.endsWith('/v2/checkout/orders'));
  assert.ok(orders[0].init.headers['PayPal-Request-Id']);
  assert.notEqual(orders[0].init.headers['PayPal-Request-Id'], orders[1].init.headers['PayPal-Request-Id']);
  const body = JSON.parse(orders[0].init.body);
  assert.equal(body.intent, 'CAPTURE');
  assert.equal(body.purchase_units[0].amount.breakdown.item_total.value, '40.00');
});
test('capture reads purchase_units[0].payments.captures[0]', async () => {
  const f = mockFetch({ '/v1/oauth2/token': token, '*': () => [201, { id: 'O1', status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAP1', status: 'COMPLETED', amount: { value: '40.00' }, custom_id: 'X' }] } }] }] });
  const r = await createPayPalClient({ clientId: 'a', clientSecret: 'b', fetchImpl: f }).captureOrder('O1');
  assert.equal(r.capture_id, 'CAP1'); assert.equal(r.amount_cents, 4000);
});
test('errors surface name, issue and debug_id', async () => {
  const f = mockFetch({ '/v1/oauth2/token': token, '*': () => [422, { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'INSTRUMENT_DECLINED' }], debug_id: 'dbg123' }] });
  await assert.rejects(createPayPalClient({ clientId: 'a', clientSecret: 'b', fetchImpl: f }).captureOrder('O1'), (e) => e instanceof PayPalError && e.issue === 'INSTRUMENT_DECLINED' && e.debug_id === 'dbg123');
});
test('payout batch: idempotent request id = batch id, zero items dropped', async () => {
  const body = buildPayoutBody({ batch_id: 'FL-1', subject: 's', items: [{ receiver: 'm@x.com', amount_cents: 600, note: 'n', sender_item_id: 'C-LENDER' }, { receiver: 'r@x.com', amount_cents: 0, note: 'n', sender_item_id: 'C-B' }] });
  assert.equal(body.sender_batch_header.sender_batch_id, 'FL-1');
  assert.equal(body.items.length, 1);
  assert.deepEqual(body.items[0].amount, { value: '6.00', currency: 'USD' });
  assert.equal(body.items[0].recipient_type, 'EMAIL');
  const f = mockFetch({ '/v1/oauth2/token': token, '*': () => [201, { batch_header: { payout_batch_id: 'B1', batch_status: 'PENDING' } }] });
  await createPayPalClient({ clientId: 'a', clientSecret: 'b', fetchImpl: f }).createPayout({ batch_id: 'FL-1', subject: 's', items: [{ receiver: 'm@x.com', amount_cents: 600, note: 'n', sender_item_id: 'X' }] });
  assert.equal(f.calls[1].init.headers['PayPal-Request-Id'], 'FL-1');
});
test('order body rejects mismatched item totals', () => {
  assert.throws(() => buildOrderBody({ amount_cents: 100, description: 'x', custom_id: 'y', items: [{ name: 'a', unit_amount_cents: 50 }] }));
});
