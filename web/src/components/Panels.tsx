import { api, fmt, type State } from '../api';
import { Card, Pill, statusTone, useAction, Feedback, Spinner, Empty } from './ui';
import { Shield, Send, Refresh, Clock, Check, Heart } from './Icons';
import { PayPalButton, SubscribeButton } from './PayPalButton';

export function PaypalBadge({ s }: { s: State }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Pill tone={s.config.paypal_mode === 'sandbox' ? 'ok' : 'warn'}>PayPal {s.config.paypal_mode === 'sandbox' ? 'sandbox' : 'simulated'}</Pill>
      <Pill tone={s.config.ai === 'gemini' ? 'info' : 'neutral'}>AI: {s.config.ai === 'gemini' ? 'Gemini' : 'offline'}</Pill>
    </div>
  );
}

const FB: Record<string, { label: string; tone: 'ok' | 'warn' | 'neutral' | 'danger' | 'info'; text: string }> = {
  not_set_up: { label: 'Not set up', tone: 'neutral', text: 'Set up after both approve the agreement.' },
  approval_needed: { label: 'Needs Ravi', tone: 'warn', text: 'Ravi approves a small PayPal subscription that stays suspended unless sales stop.' },
  SUSPENDED: { label: 'Standby', tone: 'ok', text: 'Suspended. It only starts if FairLoop income is $0 (or under 25% of what Ravi declared) for 3 weeks with no hardship pause.' },
  ACTIVE: { label: 'Active', tone: 'danger', text: 'FairLoop income stopped, so the agreed fallback is running. It suspends again as soon as sales return.' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral', text: 'Loan closed, so the fallback was cancelled.' },
};

export function FallbackCard({ s, role, onState }: { s: State; role: 'lender' | 'borrower'; onState: (s: State) => void }) {
  const f = s.fallback; const info = FB[f.status] || FB.not_set_up;
  const act = useAction();
  const amount = s.agreement?.terms.fallback_weekly_cents ?? 500;
  return (
    <Card id="fallback" title={<span className="flex items-center gap-2"><Shield className="text-accent" />Diversion safeguard</span>} action={<Pill tone={info.tone}>{info.label}</Pill>}>
      <p className="text-sm text-muted"><span className="font-semibold text-ink num">{fmt(amount)}/week</span> PayPal Subscription. {info.text}</p>
      {f.message && f.status === 'ACTIVE' && <p className="mt-3 rounded-xl bg-warmsoft px-3 py-2 text-sm text-warm">{f.message}</p>}
      {f.last_check && <p className="mt-2 text-xs text-muted">Last check: {f.last_check.reason}</p>}
      {f.subscription_id && <p className="mt-2 break-all text-xs text-muted">Subscription {f.subscription_id}</p>}
      {f.status === 'approval_needed' && role === 'borrower' && (
        <div className="mt-4"><SubscribeButton mode={s.config.paypal_mode} clientId={s.config.paypal_client_id} onDone={async () => onState(await api('/api/state'))} onError={act.setError} /></div>
      )}
      <Feedback error={act.error} ok={act.ok} />
    </Card>
  );
}

export function FundCard({ s, onState }: { s: State; onState: (s: State) => void }) {
  const act = useAction();
  const ready = s.agreement?.active && ['SUSPENDED', 'ACTIVE'].includes(s.fallback.status);
  if (s.loan) return null;
  return (
    <Card id="fund" title="Fund the loan">
      <p className="text-sm text-muted">Pay <span className="font-semibold text-ink num">{fmt(s.agreement?.terms.principal_cents || 0)}</span> with PayPal. FairLoop captures it and immediately sends it to {s.personas.borrower.name} with PayPal Payouts.</p>
      {!s.agreement?.active && <p className="mt-3 text-sm text-warm">Waiting for both approvals.</p>}
      {s.agreement?.active && !ready && <p className="mt-3 text-sm text-warm">Waiting for {s.personas.borrower.name} to set up the fallback safeguard.</p>}
      <div className="mt-4 max-w-md">
        <PayPalButton mode={s.config.paypal_mode} clientId={s.config.paypal_client_id} disabled={!ready} label="Fund with PayPal" onError={act.setError}
          createOrder={async () => (await api<{ id: string }>('/api/fund/order', {})).id}
          capture={async (id) => { await act.run('cap', async () => onState(await api('/api/fund/capture', { order_id: id })), 'Funded! The money is on its way to Ravi.'); }} />
      </div>
      <Feedback error={act.error} ok={act.ok} />
    </Card>
  );
}

export function PayoutsCard({ s, onState }: { s: State; onState: (s: State) => void }) {
  const act = useAction();
  return (
    <Card id="payouts" title="PayPal payouts" action={<button className="btn-ghost !min-h-[40px] !px-3 text-sm" disabled={!!act.busy || !s.payouts.length} onClick={() => act.run('r', async () => { for (const p of s.payouts.slice(0, 8)) if (p.batch_status !== 'SUCCESS') await api(`/api/payouts/${p.payout_batch_id}/refresh`, {}); onState(await api('/api/state')); }, 'Statuses refreshed from PayPal.')}>{act.busy ? <Spinner /> : <Refresh width={16} height={16} />}Refresh</button>}>
      {!s.payouts.length ? <Empty icon={<Send />} title="No payouts yet" text="Disbursements and repayment splits will show here with their PayPal status." /> : (
        <ul className="space-y-3">
          {s.payouts.slice(0, 8).map((p) => (
            <li key={p.payout_batch_id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{p.kind === 'disbursement' ? 'Loan disbursement' : 'Payment split'}</span><Pill tone={statusTone(p.batch_status)}>{p.batch_status}</Pill></div>
              <p className="mt-1 break-all text-xs text-muted">Batch {p.payout_batch_id}</p>
              <ul className="mt-2 space-y-1">
                {p.items.map((i) => (<li key={i.sender_item_id} className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 truncate">{i.who === 'lender' ? s.personas.lender.name : s.personas.borrower.name} <span className="text-muted">· {i.sender_item_id.split('-').slice(-1)[0].toLowerCase()}</span></span><span className="flex shrink-0 items-center gap-2"><span className="num font-semibold">{fmt(i.amount_cents)}</span><Pill tone={statusTone(i.status)}>{i.status}</Pill></span></li>))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <Feedback error={act.error} ok={act.ok} />
    </Card>
  );
}

export function Timeline({ s, limit = 8 }: { s: State; limit?: number }) {
  return (
    <Card id="timeline" title="Recent payments">
      {!s.payments.length ? <Empty icon={<Heart />} title="No customer payments yet" text="When Ravi's customers pay through his FairLoop page, each split appears here with the reason." /> : (
        <ol className="space-y-3">
          {s.payments.slice(0, limit).map((p) => (
            <li key={p.capture_id} className="flex gap-3">
              <span className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${p.decision.lender_cents ? 'bg-accentsoft text-accent' : 'bg-warmsoft text-warm'}`}>{p.decision.lender_cents ? <Check width={16} height={16} /> : <Clock width={16} height={16} />}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3"><span className="font-semibold">{p.product} <span className="font-normal text-muted num">{fmt(p.amount_cents)}</span></span><span className="text-xs text-muted">{p.week}{p.simulated ? ' · simulated' : ''}</span></div>
                <p className="text-sm text-muted">{p.decision.reason}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function PaidOff({ s }: { s: State }) {
  if (!s.loan || !['repaid', 'forgiven'].includes(s.loan.status)) return null;
  const weeks = Object.keys(s.loan.weeks).length;
  const n = s.payments.filter((p) => p.decision.lender_cents > 0).length;
  return (
    <section className="card relative overflow-hidden border-accent/40 p-6 sm:p-8" aria-live="polite">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accentsoft" aria-hidden="true" />
      <p className="relative font-display text-3xl font-semibold">{s.loan.status === 'repaid' ? 'Loan repaid 🎉' : 'Loan closed'}</p>
      <p className="relative mt-2 max-w-xl text-muted">{s.personas.borrower.name} paid back <span className="font-semibold text-ink num">{fmt(s.loan.repaid_cents)}</span> to {s.personas.lender.name} over {weeks} week{weeks === 1 ? '' : 's'}, from {n} customer payments. 0% interest. Deductions have stopped{s.fallback.status === 'CANCELLED' ? ' and the fallback was cancelled' : ''}.</p>
      {s.loan.forgiven_cents ? <p className="relative mt-2 text-sm text-muted">{fmt(s.loan.forgiven_cents)} forgiven as agreed.</p> : null}
    </section>
  );
}

export function Notifications({ s, role }: { s: State; role: string }) {
  const list = s.notifications.filter((n) => n.to === role || n.to === 'both').slice(0, 3);
  if (!list.length) return null;
  return (<div aria-live="polite" className="space-y-2">{list.map((n) => <p key={n.id} className="rounded-xl border border-line bg-card px-4 py-3 text-sm shadow-soft">{n.text}</p>)}</div>);
}
