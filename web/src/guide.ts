// Derives "where are we in the demo" and "what should happen next" from server state.
import type { State } from './api';

export type Route = '/borrower' | '/lender' | '/pay/ravi' | '/ledger';
export interface Step { key: string; done: boolean; to: Route; optional?: boolean }

export function progress(s: State): Step[] {
  const a = s.agreement;
  const fbReady = ['SUSPENDED', 'ACTIVE', 'CANCELLED'].includes(s.fallback.status);
  return [
    { key: 'request', done: !!a, to: '/borrower' },
    { key: 'approve', done: !!a?.active || !!s.loan, to: a?.approvals.borrower ? '/lender' : '/borrower' },
    { key: 'safeguard', done: fbReady, to: '/borrower' },
    { key: 'fund', done: !!s.loan, to: '/lender' },
    { key: 'sale', done: (s.real_sales ?? 0) > 0 || s.payments.some((p) => !p.simulated), to: '/pay/ravi' },
    { key: 'hardship', done: s.hardships.some((h) => h.status !== 'pending'), to: s.hardships.some((h) => h.status === 'pending') ? '/lender' : '/borrower', optional: true },
    { key: 'repaid', done: !!s.loan && s.loan.status !== 'active', to: '/borrower' },
  ];
}

export interface Next { key: string; to: Route }
export function nextStep(s: State): Next {
  const a = s.agreement;
  if (!a) return { key: 'request', to: '/borrower' };
  if (!a.active && !s.loan) {
    if (a.approvals.borrower && !a.approvals.lender) return { key: 'approveLender', to: '/lender' };
    if (a.approvals.lender && !a.approvals.borrower) return { key: 'approveBorrower', to: '/borrower' };
    return { key: 'approveBoth', to: '/borrower' };
  }
  if (!['SUSPENDED', 'ACTIVE', 'CANCELLED'].includes(s.fallback.status)) return { key: 'safeguard', to: '/borrower' };
  if (!s.loan) return { key: 'fund', to: '/lender' };
  if (s.loan.status !== 'active') return { key: 'repaid', to: '/ledger' };
  if (s.hardships.some((h) => h.status === 'pending')) return { key: 'hardship', to: '/lender' };
  if (s.review?.status === 'open') return { key: 'review', to: '/borrower' };
  if (!s.payments.length && !s.real_sales) return { key: 'sale', to: '/pay/ravi' };
  return { key: 'explore', to: '/borrower' };
}
