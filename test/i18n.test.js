import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summariesAll, summarize, followUp, checkIn, money, LANGS } from '../server/lib/i18n.js';
import { offlineHardship, offlinePlan } from '../server/lib/ai.js';
import { validateTerms } from '../server/lib/engine.js';
import { SEED_HISTORY } from '../server/seed.js';

const terms = validateTerms({ principal_cents: 30000, tiers: [{ min_weekly_cents: 3000, share_bps: 1500 }], weekly_min_income_cents: 3000, weekly_cap_cents: 2000, term_weeks: 52, end_of_term_action: 'review', fallback_weekly_cents: 500 }).terms;

test('agreement summaries exist in all 4 languages and carry the same numbers', () => {
  const all = summariesAll(terms);
  assert.deepEqual(Object.keys(all), LANGS);
  assert.match(all.en, /\$300\.00 at 0% interest/);
  assert.match(all.hi, /0% ब्याज/);
  assert.match(all.fr, /0 % d’intérêt/);
  assert.match(all.es, /0 % de interés/);
  for (const l of LANGS) assert.ok(all[l].includes('52'), `${l} mentions the term`);
  assert.equal(summarize(terms, 'xx'), all.en, 'unknown language falls back to English');
});
test('money is formatted per locale as USD', () => {
  assert.equal(money(30000, 'en'), '$300.00');
  assert.match(money(30000, 'fr'), /300,00/);
  assert.match(money(30000, 'es'), /300,00/);
});
test('follow-up and check-in templates are localized', () => {
  assert.notEqual(followUp('hi'), followUp('en'));
  assert.match(checkIn({ borrower: 'Ravi', lender: 'Maya', fallback_cents: 500 }, 'es'), /respaldo/);
});
test('offline hardship parser understands Hindi, French and Spanish', () => {
  const cases = {
    en: 'I was sick this week, can I pause for 2 weeks?',
    hi: 'मैं इस हफ़्ते बीमार था, क्या मैं 2 हफ़्ते के लिए किस्तें रोक सकता हूँ?',
    fr: 'J’étais malade cette semaine, puis-je faire une pause de 2 semaines ?',
    es: 'Estuve enfermo esta semana, ¿puedo hacer una pausa de 2 semanas?',
  };
  for (const [l, text] of Object.entries(cases)) {
    const h = offlineHardship(text);
    assert.equal(h.type, 'pause', l);
    assert.equal(h.weeks, 2, l);
    assert.equal(h.reason, 'illness', l);
  }
  assert.equal(offlineHardship('¿Puedo tener más tiempo? 6 semanas más').type, 'extend_term');
  assert.equal(offlineHardship('Pouvez-vous réduire la part à 10 % ?').share_bps, 1000);
});
test('offline plan parses a Hindi request and writes the summary in Hindi', () => {
  const p = offlinePlan('मुझे नए ओवन के लिए $300 चाहिए, मैं केक के ऑर्डर से हफ़्ते में लगभग $40–120 कमाता हूँ।', SEED_HISTORY, 'hi');
  assert.equal(p.terms.principal_cents, 30000);
  assert.equal(p.terms.declared_weekly_income_cents, 8000);
  assert.equal(p.summary_lang, 'hi');
  assert.match(p.summary, /ब्याज/);
  assert.match(offlinePlan('hola', SEED_HISTORY, 'es').follow_up_question, /prestado/);
});

test('HTTP: loan request in French stores all 4 summaries and the request language', async () => {
  const { createApp } = await import('../server/app.js');
  const { memoryStore } = await import('../server/lib/store.js');
  const { createSimulatedPayPal } = await import('../server/lib/paypal.js');
  const { createAI } = await import('../server/lib/ai.js');
  const { seed } = await import('../server/seed.js');
  const server = createApp({ store: memoryStore(seed), paypal: createSimulatedPayPal(), ai: createAI({}) }).listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/loan/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'J’ai besoin de 300 $ pour un four, je gagne 40–120 $ par semaine.', lang: 'fr' }) });
    const s = await r.json();
    assert.equal(s.agreement.summary_lang, 'fr');
    assert.match(s.agreement.summary, /intérêt/);
    assert.deepEqual(Object.keys(s.agreement.summaries).sort(), ['en', 'es', 'fr', 'hi']);
  } finally { server.close(); }
});
