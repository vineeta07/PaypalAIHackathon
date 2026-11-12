// PayPal REST client (sandbox) + simulated twin with the same interface.
import crypto from 'node:crypto';

export class PayPalError extends Error {
  constructor(status, body) {
    const issue = body?.details?.[0]?.issue;
    super(`${body?.name || 'PAYPAL_ERROR'}${issue ? `: ${issue}` : ''}${body?.message ? ` — ${body.message}` : ''}`);
    this.status = status;
    this.name_ = body?.name || 'PAYPAL_ERROR';
    this.issue = issue || null;
    this.debug_id = body?.debug_id || null;
  }
  toJSON() { return { name: this.name_, issue: this.issue, debug_id: this.debug_id, message: this.message }; }
}

export function buildOrderBody({ amount_cents, description, custom_id, items = [] }) {
  const v = (c) => (c / 100).toFixed(2);
  const list = items.length ? items : [{ name: description, quantity: 1, unit_amount_cents: amount_cents }];
  const total = list.reduce((s, it) => s + it.unit_amount_cents * (it.quantity || 1), 0);
  if (total !== amount_cents) throw new Error('Item total does not match amount');
  return {
    intent: 'CAPTURE',
    purchase_units: [{
      custom_id, description: description.slice(0, 127),
      amount: { currency_code: 'USD', value: v(amount_cents), breakdown: { item_total: { currency_code: 'USD', value: v(amount_cents) } } },
      items: list.map((it) => ({ name: it.name.slice(0, 127), quantity: String(it.quantity || 1), unit_amount: { currency_code: 'USD', value: v(it.unit_amount_cents) }, category: 'DIGITAL_GOODS' })),
    }],
    application_context: { shipping_preference: 'NO_SHIPPING', brand_name: 'FairLoop' },
  };
}

export function buildPayoutBody({ batch_id, subject, items }) {
  return {
    sender_batch_header: { sender_batch_id: batch_id, email_subject: subject, email_message: 'Sent via FairLoop.' },
    items: items.filter((i) => i.amount_cents > 0).map((i) => ({
      recipient_type: 'EMAIL', receiver: i.receiver,
      amount: { value: (i.amount_cents / 100).toFixed(2), currency: 'USD' },
      note: i.note.slice(0, 4000), sender_item_id: i.sender_item_id,
    })),
  };
}

export function createPayPalClient({ clientId, clientSecret, base = 'https://api-m.sandbox.paypal.com', fetchImpl = globalThis.fetch, uuid = () => crypto.randomUUID() }) {
  let token = null;
  let tokenExp = 0;
  async function getToken() {
    if (token && Date.now() < tokenExp) return token;
    const r = await fetchImpl(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new PayPalError(r.status, { name: 'AUTHENTICATION_FAILURE', message: body.error_description || 'Could not get PayPal token', debug_id: body.debug_id });
    token = body.access_token;
    tokenExp = Date.now() + Math.max(0, (body.expires_in || 300) - 60) * 1000;
    return token;
  }
  async function call(method, path, body, { requestId } = {}) {
    const headers = { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
    if (method === 'POST') headers['PayPal-Request-Id'] = requestId || uuid();
    const r = await fetchImpl(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 204) return {};
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new PayPalError(r.status, json);
    return json;
  }
  return {
    mode: 'sandbox',
    getToken,
    createOrder: async (o) => { const res = await call('POST', '/v2/checkout/orders', buildOrderBody(o)); return { id: res.id, status: res.status }; },
    captureOrder: async (id) => {
      const res = await call('POST', `/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {});
      const pu = res.purchase_units?.[0];
      const cap = pu?.payments?.captures?.[0];
      return { order_id: res.id, status: res.status, capture_id: cap?.id, capture_status: cap?.status, amount_cents: cap ? Math.round(Number(cap.amount.value) * 100) : 0, custom_id: cap?.custom_id || pu?.custom_id, payer_email: res.payer?.email_address };
    },
    createPayout: async (p) => { const res = await call('POST', '/v1/payments/payouts', buildPayoutBody(p), { requestId: p.batch_id }); return { payout_batch_id: res.batch_header?.payout_batch_id, batch_status: res.batch_header?.batch_status }; },
    getPayout: async (id) => {
      const res = await call('GET', `/v1/payments/payouts/${encodeURIComponent(id)}`);
      return { payout_batch_id: id, batch_status: res.batch_header?.batch_status, items: (res.items || []).map((i) => ({ sender_item_id: i.payout_item?.sender_item_id, transaction_status: i.transaction_status, payout_item_id: i.payout_item_id, receiver: i.payout_item?.receiver, value: i.payout_item?.amount?.value })) };
    },
    createPlan: async ({ amount_cents, name }) => {
      const product = await call('POST', '/v1/catalogs/products', { name: 'FairLoop fallback repayment', type: 'SERVICE', category: 'SOFTWARE' });
      const plan = await call('POST', '/v1/billing/plans', {
        product_id: product.id, name: name.slice(0, 127), status: 'ACTIVE',
        billing_cycles: [{ frequency: { interval_unit: 'WEEK', interval_count: 1 }, tenure_type: 'REGULAR', sequence: 1, total_cycles: 0, pricing_scheme: { fixed_price: { value: (amount_cents / 100).toFixed(2), currency_code: 'USD' } } }],
        payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 },
      });
      return { plan_id: plan.id, product_id: product.id };
    },
    getSubscription: async (id) => { const r = await call('GET', `/v1/billing/subscriptions/${encodeURIComponent(id)}`); return { id: r.id, status: r.status }; },
    suspendSubscription: (id, reason) => call('POST', `/v1/billing/subscriptions/${encodeURIComponent(id)}/suspend`, { reason: reason.slice(0, 127) }),
    activateSubscription: (id, reason) => call('POST', `/v1/billing/subscriptions/${encodeURIComponent(id)}/activate`, { reason: reason.slice(0, 127) }),
    cancelSubscription: (id, reason) => call('POST', `/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, { reason: reason.slice(0, 127) }),
    verifyWebhook: async ({ headers, event, webhookId }) => {
      const r = await call('POST', '/v1/notifications/verify-webhook-signature', {
        auth_algo: headers['paypal-auth-algo'], cert_url: headers['paypal-cert-url'], transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'], transmission_time: headers['paypal-transmission-time'], webhook_id: webhookId, webhook_event: event,
      });
      return r.verification_status === 'SUCCESS';
    },
  };
}

/** Simulated PayPal: same interface, deterministic SIM- ids, no network. */
export function createSimulatedPayPal() {
  const orders = new Map();
  const payouts = new Map();
  const subs = new Map();
  const id = (p) => `SIM-${p}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  return {
    mode: 'simulated',
    async getToken() { return 'SIM-TOKEN'; },
    async createOrder(o) { buildOrderBody(o); const oid = id('ORDER'); orders.set(oid, { ...o, status: 'CREATED' }); return { id: oid, status: 'CREATED' }; },
    async captureOrder(oid) {
      const o = orders.get(oid);
      if (!o) throw new PayPalError(404, { name: 'RESOURCE_NOT_FOUND', details: [{ issue: 'INVALID_RESOURCE_ID' }], debug_id: 'SIM-DEBUG' });
      if (o.status === 'COMPLETED') throw new PayPalError(422, { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'ORDER_ALREADY_CAPTURED' }], debug_id: 'SIM-DEBUG' });
      o.status = 'COMPLETED';
      return { order_id: oid, status: 'COMPLETED', capture_id: id('CAPTURE'), capture_status: 'COMPLETED', amount_cents: o.amount_cents, custom_id: o.custom_id, payer_email: 'customer@example.com' };
    },
    async createPayout(p) {
      const body = buildPayoutBody(p);
      for (const [pid, v] of payouts) if (v.batch_id === p.batch_id) return { payout_batch_id: pid, batch_status: v.status };
      const pid = id('PAYOUT');
      payouts.set(pid, { batch_id: p.batch_id, items: body.items, status: 'PENDING', polls: 0 });
      return { payout_batch_id: pid, batch_status: 'PENDING' };
    },
    async getPayout(pid) {
      const p = payouts.get(pid);
      if (!p) return { payout_batch_id: pid, batch_status: 'SUCCESS', items: [] };
      p.polls += 1;
      const done = p.polls >= 1;
      if (done) p.status = 'SUCCESS';
      return { payout_batch_id: pid, batch_status: p.status, items: p.items.map((i) => ({ sender_item_id: i.sender_item_id, transaction_status: done ? 'SUCCESS' : 'PENDING', payout_item_id: `SIM-ITEM-${i.sender_item_id}`, receiver: i.receiver, value: i.amount.value })) };
    },
    async createPlan() { return { plan_id: id('PLAN'), product_id: id('PROD') }; },
    async createSimSubscription() { const sid = id('SUB'); subs.set(sid, 'ACTIVE'); return { id: sid }; },
    async getSubscription(sid) { return { id: sid, status: subs.get(sid) || 'ACTIVE' }; },
    async suspendSubscription(sid) { subs.set(sid, 'SUSPENDED'); return {}; },
    async activateSubscription(sid) { subs.set(sid, 'ACTIVE'); return {}; },
    async cancelSubscription(sid) { subs.set(sid, 'CANCELLED'); return {}; },
    async verifyWebhook() { return true; },
  };
}
