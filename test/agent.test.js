import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAgent, offlineAgent, detectLang } from '../server/lib/agent.js';
import { createApp } from '../server/app.js';
import { memoryStore } from '../server/lib/store.js';
import { createSimulatedPayPal } from '../server/lib/paypal.js';
import { createAI } from '../server/lib/ai.js';
import { seed } from '../server/seed.js';

const ctx = {
  lender: 'Maya', borrower: 'Ravi', has_agreement: true, fallback_status: 'SUSPENDED', pending_hardships: 0, next_step: 'sale', next_page: 'pay',
  loan: { status: 'active', principal_cents: 30000, repaid_cents: 600, remaining_cents: 29400, paused_until: null },
  week: { week: '2026-W46', income_cents: 1200, deducted_cents: 0, min_cents: 3000, cap_cents: 2000, paused: false },
};

test('detects the language the person spoke', () => {
  assert.equal(detectLang('how much is left?'), 'en');
  assert.equal(detectLang('मुझे लेजर दिखाओ'), 'hi');
  assert.equal(detectLang('Combien reste-t-il à rembourser ?'), 'fr');
  assert.equal(detectLang('¿Cuánto queda por pagar?'), 'es');
  assert.equal(detectLang('ok', 'fr'), 'fr', 'falls back to the app language');
  assert.equal(detectLang('¿Qué hago ahora?'), 'es', 'Spanish question with é is still Spanish');
  assert.equal(detectLang('Qu’est-ce que je dois faire ?'.replace('’', "'")), 'fr');
  assert.equal(detectLang('Où en est le prêt ?'), 'fr');
});

test('offline agent answers balance questions in the speaker’s language', () => {
  const en = offlineAgent('How much is left to pay?', ctx);
  assert.equal(en.lang, 'en'); assert.match(en.reply, /\$294\.00/); assert.match(en.reply, /no interest/);
  const hi = offlineAgent('कितना बाकी है?', ctx, 'en');
  assert.equal(hi.lang, 'hi'); assert.match(hi.reply, /बाकी|लौटाने/);
  const fr = offlineAgent('Combien reste-t-il ?', ctx, 'en');
  assert.equal(fr.lang, 'fr'); assert.match(fr.reply, /294,00/);
  const es = offlineAgent('¿Cuánto queda?', ctx, 'en');
  assert.equal(es.lang, 'es'); assert.match(es.reply, /Quedan/);
});

test('offline agent explains the week and the minimum', () => {
  const r = offlineAgent('How is this week going?', ctx);
  assert.match(r.reply, /below the \$30\.00 minimum/);
});

test('offline agent navigates in all four languages', () => {
  for (const [text, page] of [['show me the ledger', 'ledger'], ['मुझे लेजर दिखाओ', 'ledger'], ['ouvre la page de Maya', 'lender'], ['llévame a la página de pago', 'pay']]) {
    const r = offlineAgent(text, ctx);
    assert.deepEqual(r.actions[0], { type: 'navigate', page, to: { ledger: '/ledger', lender: '/lender', pay: '/pay/ravi' }[page] }, text);
  }
});

test('offline agent prefills a hardship request but never sends it', () => {
  const r = offlineAgent('Estuve enfermo, ¿puedo hacer una pausa de 2 semanas?', ctx);
  assert.equal(r.lang, 'es');
  assert.ok(r.actions.some((a) => a.type === 'prefill_hardship'));
  assert.ok(!r.actions.some((a) => a.type === 'hardship_send'));
  const noLoan = offlineAgent('I was sick, can I pause?', { ...ctx, loan: null });
  assert.equal(noLoan.actions.length, 0);
});

test('offline agent: language switch, tour, install, simulate needs a tap', () => {
  assert.deepEqual(offlineAgent('switch to Hindi', ctx).actions, [{ type: 'set_language', lang: 'hi' }]);
  assert.deepEqual(offlineAgent('start the tour', ctx).actions, [{ type: 'start_tour' }]);
  assert.deepEqual(offlineAgent('how do I install this on my home screen', ctx).actions, [{ type: 'install' }]);
  const sim = offlineAgent('simulate a slow week', ctx);
  assert.deepEqual(sim.actions, [{ type: 'confirm', op: 'simulate_week', mode: 'low' }]);
});

test('Gemini agent: function-calling loop with data tool, UI tool and respond', async () => {
  const calls = [];
  const replies = [
    { candidates: [{ content: { parts: [{ functionCall: { name: 'get_loan_status', args: {} } }] } }] },
    { candidates: [{ content: { parts: [{ functionCall: { name: 'navigate', args: { page: 'ledger' } } }, { functionCall: { name: 'approve_everything', args: {} } }] } }] },
    { candidates: [{ content: { parts: [{ functionCall: { name: 'respond', args: { text: 'Quedan 294 dólares. Abro el registro.', language: 'es' } } }] } }] },
  ];
  const fetchImpl = async (url, init) => { calls.push(JSON.parse(init.body)); return { ok: true, json: async () => replies[calls.length - 1] }; };
  const agent = createAgent({ apiKey: 'k', fetchImpl });
  const r = await agent.ask({ text: '¿Cuánto queda? Muéstrame el registro', lang: 'en' }, ctx);
  assert.equal(r.ai, 'gemini'); assert.equal(r.lang, 'es');
  assert.deepEqual(r.actions, [{ type: 'navigate', page: 'ledger', to: '/ledger' }], 'unknown tools are ignored');
  const statusResponse = calls[1].contents.at(-1).parts[0].functionResponse;
  assert.equal(statusResponse.name, 'get_loan_status');
  assert.equal(statusResponse.response.loan.remaining, '$294.00');
  assert.ok(calls[0].tools[0].functionDeclarations.some((f) => f.name === 'prefill_hardship_request'));
});

test('Gemini agent falls back to offline rules on error', async () => {
  const agent = createAgent({ apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({ error: { message: 'boom' } }) }) });
  const r = await agent.ask({ text: 'how much is left?' }, ctx);
  assert.equal(r.ai, 'offline'); assert.match(r.reply, /\$294\.00/);
});

test('HTTP: /api/agent uses live state', async () => {
  const server = createApp({ store: memoryStore(seed), paypal: createSimulatedPayPal(), ai: createAI({}) }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (p, b) => { const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, body: await r.json() }; };
  try {
    let r = await post('/api/agent', { text: 'How much is left?', lang: 'en' });
    assert.equal(r.status, 200); assert.match(r.body.reply, /no active loan/);
    r = await post('/api/agent', { text: 'मुझे नए ओवन के लिए $300 चाहिए', lang: 'en' });
    assert.equal(r.body.lang, 'hi');
    assert.ok(r.body.actions.some((a) => a.type === 'prefill_request'));
    r = await post('/api/agent', { text: '' });
    assert.equal(r.status, 400);
  } finally { server.close(); }
});
