export const SEED_HISTORY = [8500, 6200, 11800, 4000, 9600, 7300, 12000, 5400]; // Ravi's last 8 weeks, cents
export function seed() {
  return {
    version: 1,
    clock_offset_weeks: 0,
    personas: {
      lender: { id: 'maya', name: 'Maya', label: 'Maya (sister, in Toronto)', email: process.env.LENDER_PAYPAL_EMAIL || 'maya.lender@example.com' },
      borrower: { id: 'ravi', name: 'Ravi', label: 'Ravi, a home baker', email: process.env.BORROWER_PAYPAL_EMAIL || 'ravi.baker@example.com' },
    },
    products: [
      { id: 'choc-cake', name: 'Chocolate celebration cake', price_cents: 4000, art: 'cake' },
      { id: 'cupcakes', name: 'Box of 6 vanilla cupcakes', price_cents: 1800, art: 'cupcake' },
      { id: 'sourdough', name: 'Fresh sourdough loaf', price_cents: 900, art: 'bread' },
      { id: 'cookies', name: 'Oat & raisin cookies (12)', price_cents: 1200, art: 'cookie' },
    ],
    income_history: SEED_HISTORY,
    request: null,
    agreement: null,
    loan: null,
    funding: null,
    payments: [],
    payouts: {},
    hardships: [],
    review: null,
    fallback: { status: 'not_set_up' },
    notifications: [],
    ledger: [],
  };
}
