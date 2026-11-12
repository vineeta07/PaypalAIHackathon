import { useEffect } from 'react';
import { api, fmt, type State } from '../api';
import { useI18n } from '../i18n';
import { reasonText, notificationText } from '../text';
import { Card, Pill, statusTone, useAction, Feedback, Spinner, Empty } from './ui';
import { Shield, Send, Refresh, Clock, Check, Heart } from './Icons';
import { PayPalButton, SubscribeButton } from './PayPalButton';

export function PaypalBadge({ s }: { s: State }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-1.5">
      <Pill tone={s.config.paypal_mode === 'sandbox' ? 'ok' : 'warn'}>{s.config.paypal_mode === 'sandbox' ? t('badge.sandbox') : t('badge.sim')}</Pill>
      <Pill tone={s.config.ai === 'gemini' ? 'info' : 'neutral'}>{t('badge.ai', { mode: t(`ai.${s.config.ai}`) })}</Pill>
    </div>
  );
}

const FB_TONE: Record<string, 'ok' | 'warn' | 'neutral' | 'danger' | 'info'> = { not_set_up: 'neutral', approval_needed: 'warn', SUSPENDED: 'ok', ACTIVE: 'danger', CANCELLED: 'neutral' };

export function FallbackCard({ s, role, onState }: { s: State; role: 'lender' | 'borrower'; onState: (s: State) => void }) {
  const { t, lang } = useI18n();
  const f = s.fallback; const st = f.status in FB_TONE ? f.status : 'not_set_up';
  const act = useAction();
  const amount = s.agreement?.terms.fallback_weekly_cents ?? 500;
  const showMsg = f.message && f.status === 'ACTIVE';
  return (
    <Card id="fallback" title={<span className="flex items-center gap-2"><Shield className="text-accent" />{t('fb.title')}</span>} action={<Pill tone={FB_TONE[st]}>{t(`fb.${st}`)}</Pill>}>
      <p className="text-sm text-muted"><span className="font-semibold text-ink num">{t('fb.sub', { amount: fmt(amount) })}</span> {t(`fb.${st}.t`)}</p>
      {showMsg && <p className="mt-3 rounded-xl bg-warmsoft px-3 py-2 text-sm text-warm">{(f.message_lang || 'en') === lang ? f.message : t('n.fallbackOn', { amount: fmt(amount) })}</p>}
      {f.last_check && <p className="mt-2 text-xs text-muted">{t('fb.lastCheck', { week: f.last_check.week, text: t(`fb.check.${f.last_check.action}`, {}, f.last_check.reason) })}</p>}
      {f.subscription_id && <p className="mt-2 break-all text-xs text-muted">{t('fb.subscription', { id: f.subscription_id })}</p>}
      {f.status === 'approval_needed' && role === 'borrower' && (
        <div className="mt-4"><SubscribeButton mode={s.config.paypal_mode} clientId={s.config.paypal_client_id} onDone={async () => onState(await api('/api/state'))} onError={act.setError} /></div>
      )}
      <Feedback error={act.error} ok={act.ok} />
    </Card>
  );
}

export function FundCard({ s, onState }: { s: State; onState: (s: State) => void }) {
  const { t } = useI18n();
  const act = useAction();
  const ready = s.agreement?.active && ['SUSPENDED', 'ACTIVE'].includes(s.fallback.status);
  if (s.loan) return null;
  return (
    <Card id="fund" title={t('fund.title')}>
      <p className="text-sm text-muted">{t('fund.text', { amount: fmt(s.agreement?.terms.principal_cents || 0), name: s.personas.borrower.name })}</p>
      {!s.agreement?.active && <p className="mt-3 text-sm text-warm">{t('fund.waitApprovals')}</p>}
      {s.agreement?.active && !ready && <p className="mt-3 text-sm text-warm">{t('fund.waitFallback', { name: s.personas.borrower.name })}</p>}
      <div className="mt-4 max-w-md">
        <PayPalButton mode={s.config.paypal_mode} clientId={s.config.paypal_client_id} disabled={!ready} label={t('fund.button')} onError={act.setError}
          createOrder={async () => (await api<{ id: string }>('/api/fund/order', {})).id}
          capture={async (id) => { await act.run('cap', async () => onState(await api('/api/fund/capture', { order_id: id })), t('fund.ok')); }} />
      </div>
      <Feedback error={act.error} ok={act.ok} />
    </Card>
  );
}

export function PayoutsCard({ s, onState }: { s: State; onState: (s: State) => void }) {
  const { t } = useI18n();
  const act = useAction();
  const pendingIds = s.payouts.slice(0, 8).filter((p) => p.batch_status !== 'SUCCESS' || p.items.some((i) => i.status === 'PENDING')).map((p) => p.payout_batch_id).join(',');
  // Poll GET /v1/payments/payouts/{id} for pending batches (PENDING → SUCCESS / UNCLAIMED / FAILED).
  useEffect(() => {
    if (!pendingIds) return;
    const timer = setTimeout(async () => {
      try { for (const id of pendingIds.split(',')) await api(`/api/payouts/${id}/refresh`, {}); onState(await api('/api/state')); } catch { /* shown on manual refresh */ }
    }, 4000);
    return () => clearTimeout(timer);
  }, [pendingIds, onState]);
  const ps = (st: string) => t(`ps.${st}`, {}, st);
  return (
    <Card id="payouts" title={t('po.title')} action={<button className="btn-ghost !min-h-[40px] !px-3 text-sm" disabled={!!act.busy || !s.payouts.length} onClick={() => act.run('r', async () => { for (const p of s.payouts.slice(0, 8)) if (p.batch_status !== 'SUCCESS') await api(`/api/payouts/${p.payout_batch_id}/refresh`, {}); onState(await api('/api/state')); }, t('po.refreshed'))}>{act.busy ? <Spinner /> : <Refresh width={16} height={16} />}{t('po.refresh')}</button>}>
      {!s.payouts.length ? <Empty icon={<Send />} title={t('po.emptyTitle')} text={t('po.emptyText')} /> : (
        <ul className="space-y-3">
          {s.payouts.slice(0, 8).map((p) => (
            <li key={p.payout_batch_id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{p.kind === 'disbursement' ? t('po.disbursement') : t('po.split')}</span><Pill tone={statusTone(p.batch_status)}>{ps(p.batch_status)}</Pill></div>
              <p className="mt-1 break-all text-xs text-muted">{t('po.batch', { id: p.payout_batch_id })}</p>
              <ul className="mt-2 space-y-1">
                {p.items.map((i) => (<li key={i.sender_item_id} className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 truncate">{i.who === 'lender' ? s.personas.lender.name : s.personas.borrower.name} <span className="text-muted">· {t(`po.${i.who}`, {}, i.who)}</span></span><span className="flex shrink-0 items-center gap-2"><span className="num font-semibold">{fmt(i.amount_cents)}</span><Pill tone={statusTone(i.status)}>{ps(i.status)}</Pill></span></li>))}
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
  const { t } = useI18n();
  return (
    <Card id="timeline" title={t('tl.title')}>
      {!s.payments.length ? <Empty icon={<Heart />} title={t('tl.emptyTitle')} text={t('tl.emptyText')} /> : (
        <ol className="space-y-3">
          {s.payments.slice(0, limit).map((p) => (
            <li key={p.capture_id} className="flex gap-3">
              <span className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${p.decision.lender_cents ? 'bg-accentsoft text-accent' : 'bg-warmsoft text-warm'}`}>{p.decision.lender_cents ? <Check width={16} height={16} /> : <Clock width={16} height={16} />}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3"><span className="font-semibold">{productName(t, s, p.product)} <span className="font-normal text-muted num">{fmt(p.amount_cents)}</span></span><span className="text-xs text-muted">{p.week}{p.simulated ? ` · ${t('simulated')}` : ''}</span></div>
                <p className="text-sm text-muted">{reasonText(t, p.decision, s.personas.lender.name)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function productName(t: (k: string, v?: Record<string, string | number>, f?: string) => string, s: State, name: string) {
  const prod = s.products.find((x) => x.name === name);
  return prod ? t(`prod.${prod.id}`, {}, name) : name;
}

export function PaidOff({ s }: { s: State }) {
  const { t } = useI18n();
  if (!s.loan || !['repaid', 'forgiven'].includes(s.loan.status)) return null;
  const weeks = Object.keys(s.loan.weeks).length;
  const n = s.payments.filter((p) => p.decision.lender_cents > 0).length;
  return (
    <section className="card relative overflow-hidden border-accent/40 p-6 sm:p-8" aria-live="polite">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accentsoft" aria-hidden="true" />
      <p className="relative font-display text-3xl font-semibold">{s.loan.status === 'repaid' ? t('paid.title') : t('paid.closed')}</p>
      <p className="relative mt-2 max-w-xl text-muted">{t('paid.text', { b: s.personas.borrower.name, amount: fmt(s.loan.repaid_cents), l: s.personas.lender.name, weeks, n })}{s.fallback.status === 'CANCELLED' ? t('paid.fbCancelled') : ''}</p>
      {s.loan.forgiven_cents ? <p className="relative mt-2 text-sm text-muted">{t('paid.forgiven', { amount: fmt(s.loan.forgiven_cents) })}</p> : null}
    </section>
  );
}

export function Notifications({ s, role }: { s: State; role: string }) {
  const { t } = useI18n();
  const list = s.notifications.filter((n) => n.to === role || n.to === 'both').slice(0, 3);
  if (!list.length) return null;
  return (<div aria-live="polite" className="space-y-2">{list.map((n) => <p key={n.id} className="rounded-xl border border-line bg-card px-4 py-3 text-sm shadow-soft">{notificationText(t, n)}</p>)}</div>);
}
