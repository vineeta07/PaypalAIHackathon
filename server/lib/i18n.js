// Server-side language templates for text the server writes itself (agreement summaries,
// follow-up questions, check-in messages). UI strings live in web/src/i18n.ts.
export const LANGS = ['en', 'hi', 'fr', 'es'];
export const LANG_NAMES = { en: 'English', hi: 'Hindi', fr: 'French', es: 'Spanish' };
const LOCALES = { en: 'en-US', hi: 'hi-IN', fr: 'fr-FR', es: 'es-ES' };

export function normLang(l) { return LANGS.includes(l) ? l : 'en'; }
export function money(cents, lang = 'en') {
  return new Intl.NumberFormat(LOCALES[normLang(lang)], { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function summarize(t, lang = 'en') {
  const m = (c) => money(c, lang);
  const tiersBy = {
    en: (x) => `${x.share_bps / 100}% in weeks you earn ${m(x.min_weekly_cents)}+`,
    hi: (x) => `जिस हफ़्ते आप ${m(x.min_weekly_cents)} या ज़्यादा कमाएँ, उसमें ${x.share_bps / 100}%`,
    fr: (x) => `${x.share_bps / 100} % les semaines où vous gagnez ${m(x.min_weekly_cents)} ou plus`,
    es: (x) => `${x.share_bps / 100} % en las semanas en que ganes ${m(x.min_weekly_cents)} o más`,
  };
  const L = normLang(lang);
  const tiers = t.tiers.map(tiersBy[L]).join(L === 'hi' ? '; ' : ', ');
  const forgive = t.end_of_term_action === 'forgive_remaining';
  switch (L) {
    case 'hi':
      return `${m(t.principal_cents)}, 0% ब्याज पर। जब भी आपको FairLoop से भुगतान मिलेगा, उसका एक हिस्सा अपने-आप लौट जाएगा: ${tiers}। जिस हफ़्ते आपकी कमाई ${m(t.weekly_min_income_cents)} से कम हो, उस हफ़्ते कुछ नहीं कटेगा। एक हफ़्ते में ${m(t.weekly_cap_cents)} से ज़्यादा कभी नहीं कटेगा। आप कभी भी रुकने (pause) का अनुरोध कर सकते हैं। अवधि ${t.term_weeks} हफ़्ते है; उसके बाद ${forgive ? 'बाकी रकम माफ़ कर दी जाएगी' : 'आप दोनों मिलकर बाकी रकम पर बात करेंगे'}। ${m(t.fallback_weekly_cents)}/हफ़्ते का छोटा बैकअप भुगतान तभी शुरू होगा जब FairLoop पर 3 हफ़्ते तक बिक्री बंद रहे।`;
    case 'fr':
      return `${m(t.principal_cents)} à 0 % d’intérêt. Chaque fois que vous êtes payé via FairLoop, une part est reversée automatiquement : ${tiers}. Les semaines où vous gagnez moins de ${m(t.weekly_min_income_cents)}, rien n’est prélevé. Jamais plus de ${m(t.weekly_cap_cents)} par semaine. Vous pouvez demander une pause à tout moment. La durée est de ${t.term_weeks} semaines ; ensuite, ${forgive ? 'le reste est annulé' : 'vous faites le point ensemble sur ce qui reste'}. Un petit paiement de secours de ${m(t.fallback_weekly_cents)}/semaine ne démarre que si les ventes FairLoop s’arrêtent pendant 3 semaines.`;
    case 'es':
      return `${m(t.principal_cents)} al 0 % de interés. Cada vez que te paguen a través de FairLoop, una parte se devuelve automáticamente: ${tiers}. En las semanas en que ganes menos de ${m(t.weekly_min_income_cents)}, no se descuenta nada. Nunca se descuenta más de ${m(t.weekly_cap_cents)} por semana. Puedes pedir una pausa en cualquier momento. El plazo es de ${t.term_weeks} semanas; después, ${forgive ? 'lo que quede se perdona' : 'revisáis juntos lo que quede'}. Un pequeño pago de respaldo de ${m(t.fallback_weekly_cents)}/semana solo empieza si las ventas en FairLoop se detienen durante 3 semanas.`;
    default:
      return `${m(t.principal_cents)} at 0% interest. Each time you're paid through FairLoop, a share goes back automatically: ${tiers}. In any week you earn less than ${m(t.weekly_min_income_cents)}, nothing is taken. No more than ${m(t.weekly_cap_cents)} is ever taken in one week. You can ask for a pause any time. The term is ${t.term_weeks} weeks; after that, ${forgive ? 'anything left is forgiven' : 'you both review what is left together'}. A small ${m(t.fallback_weekly_cents)}/week fallback only starts if FairLoop sales stop for 3 weeks.`;
  }
}
export function summariesAll(t) { return Object.fromEntries(LANGS.map((l) => [l, summarize(t, l)])); }

export function followUp(lang = 'en') {
  return {
    en: 'How much would you like to borrow, and roughly what do you earn in a typical week?',
    hi: 'आप कितना उधार लेना चाहते हैं, और आम तौर पर एक हफ़्ते में लगभग कितना कमाते हैं?',
    fr: 'Combien souhaitez-vous emprunter, et combien gagnez-vous environ par semaine ?',
    es: '¿Cuánto quieres pedir prestado y cuánto ganas, más o menos, en una semana normal?',
  }[normLang(lang)];
}

export function checkIn({ borrower, lender, fallback_cents }, lang = 'en') {
  const f = money(fallback_cents, lang);
  return {
    en: `Hi ${borrower} and ${lender}: FairLoop hasn't seen any sales for a few weeks, so the agreed ${f}/week fallback has started. If things are hard right now, ${borrower} can ask for a pause any time. It stops as soon as sales come back.`,
    hi: `नमस्ते ${borrower} और ${lender}: कुछ हफ़्तों से FairLoop पर कोई बिक्री नहीं हुई, इसलिए तय किया गया ${f}/हफ़्ते का बैकअप भुगतान शुरू हो गया है। अगर अभी मुश्किल समय है, तो ${borrower} कभी भी रुकने का अनुरोध कर सकते हैं। बिक्री लौटते ही यह रुक जाएगा।`,
    fr: `Bonjour ${borrower} et ${lender} : FairLoop n’a vu aucune vente depuis quelques semaines, donc le paiement de secours convenu de ${f}/semaine a démarré. Si c’est difficile en ce moment, ${borrower} peut demander une pause à tout moment. Il s’arrête dès que les ventes reprennent.`,
    es: `Hola ${borrower} y ${lender}: FairLoop no ha visto ventas en unas semanas, así que ha empezado el pago de respaldo acordado de ${f}/semana. Si ahora es un momento difícil, ${borrower} puede pedir una pausa cuando quiera. Se detiene en cuanto vuelvan las ventas.`,
  }[normLang(lang)];
}
