export type Cents = number;
export interface Tier { min_weekly_cents: Cents; share_bps: number; label?: string }
export interface Terms { principal_cents: Cents; tiers: Tier[]; weekly_min_income_cents: Cents; weekly_cap_cents: Cents; term_weeks: number; end_of_term_action: 'review' | 'forgive_remaining'; paused_until: string | null; fallback_weekly_cents: Cents; declared_weekly_income_cents: Cents; currency: string }
export interface Decision { capture_id: string; week: string; amount_cents: Cents; week_total_cents: Cents; lender_cents: Cents; borrower_cents: Cents; share_bps: number; skipped: boolean; kind: string; reason: string; paid_off?: boolean }
export interface Affordability { avg_weekly_cents: Cents; payoff_weeks: number | null; series: { week: number; balance_cents: Cents }[]; scenarios: { share_bps: number; weeks: number | null; series: Cents[] }[]; warning: string | null; suggested_principal_cents: Cents | null }
export interface HardshipReq { type: string; weeks?: number; share_bps?: number; amount_cents?: Cents; summary: string; notes?: string[] }
export interface PayoutItem { sender_item_id: string; receiver: string; amount_cents: Cents; status: string; who: string }
export interface Payout { payout_batch_id: string; kind: string; ref: string; batch_status: string; items: PayoutItem[]; created_at: string }
export interface State {
  config: { paypal_mode: 'simulated' | 'sandbox'; paypal_client_id: string | null; ai: 'gemini' | 'offline'; ai_model: string };
  week: string;
  personas: { lender: { name: string; label: string; email: string }; borrower: { name: string; label: string; email: string } };
  products: { id: string; name: string; price_cents: Cents; art: string }[];
  income_history: Cents[];
  request: null | { text: string; follow_up_question: string | null; summary: string | null; notes?: string[]; affordability?: Affordability; ai: string; ai_error?: string };
  agreement: null | { terms: Terms; terms_hash: string; approvals: { lender: null | { at: string }; borrower: null | { at: string } }; active: boolean; version: number; summary: string; notes: string[]; ai_notes?: string[]; affordability?: Affordability; last_edit_by?: string };
  loan: null | { terms: Terms; terms_hash: string; start_week: string; end_week: string; repaid_cents: Cents; remaining_cents: Cents; status: string; forgiven_cents?: Cents; weeks: Record<string, { income_cents: Cents; deducted_cents: Cents; payments: number }>; repaid_at?: string };
  funding: null | { order_id: string; status: string; capture_id?: string; payout_batch_id?: string };
  payments: { capture_id: string; amount_cents: Cents; product: string; week: string; decision: Decision; simulated: boolean; at: string; payout_batch_id?: string }[];
  payouts: Payout[];
  hardships: { id: string; text: string; request: HardshipReq; status: string; at: string; ai: string }[];
  review: null | { status: string; low_weeks: number; options: HardshipReq[]; approvals: { lender: number | null; borrower: number | null } };
  fallback: { status: string; plan_id?: string; subscription_id?: string; amount_cents?: Cents; message?: string; last_check?: { reason: string } };
  notifications: { id: string; to: string; text: string; at: string }[];
  preview: null | { week: string; week_income_cents: Cents; week_deducted_cents: Cents; sample_cents: Cents; decision: Decision };
  ledger_count: number;
}
export interface LedgerEvent { seq: number; type: string; at: string; actor: string; summary: string; amount_cents: Cents; ref: string | null; status: string; prev_hash: string; hash: string }

export class ApiError extends Error { paypal?: { name: string; issue: string | null; debug_id: string | null } }
export async function api<T = State>(path: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch { throw new ApiError('Could not reach FairLoop. Check your connection and try again.'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new ApiError(j?.error?.message || 'Something went wrong. Please try again.'); e.paypal = j?.error?.paypal; throw e; }
  return j as T;
}
export const fmt = (c: number) => `${c < 0 ? '-' : ''}$${(Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmt0 = (c: number) => (c % 100 === 0 ? `$${(c / 100).toLocaleString('en-US')}` : fmt(c));
export const pct = (bps: number) => `${bps / 100}%`;
