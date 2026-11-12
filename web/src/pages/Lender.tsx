import { api, fmt, type State } from '../api';
import { useI18n } from '../i18n';
import { hardshipLabel } from '../text';
import { Card, Pill, ProgressRing, useAction, Feedback, Spinner, Empty } from '../components/ui';
import { AgreementCard } from '../components/Agreement';
import { FallbackCard, FundCard, PayoutsCard, Timeline, PaidOff, Notifications } from '../components/Panels';
import { ReviewCard, HardshipList } from './Borrower';
import { Heart, Check } from '../components/Icons';

function PendingHardship({ s, onState }: { s: State; onState: (s: State) => void }) {
  const { t } = useI18n();
  const act = useAction();
  const pending = s.hardships.filter((h) => h.status === 'pending');
  if (!pending.length) return null;
  return (
    <Card id="pending" title={t('l.asking')} action={<Pill tone="warn">{t('l.needsYou')}</Pill>}>
      {pending.map((h) => (
        <div key={h.id} className="rounded-xl bg-paper p-4">
          <p className="text-sm text-muted">{t('l.wrote', { text: h.text })}</p>
          <p className="mt-2 text-lg font-semibold">{hardshipLabel(t, h.request, true)}</p>
          <p className="mt-1 text-xs text-muted">{t('l.structured', { by: h.ai === 'gemini' ? t('ai.gemini') : t('by.rules') })}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button className="btn-primary flex-1" disabled={!!act.busy} onClick={() => act.run('a', async () => onState(await api(`/api/hardship/${h.id}/decide`, { role: 'lender', approve: true })), t('l.approvedOk'))}>{act.busy === 'a' && <Spinner />}{t('approve')}</button>
            <button className="btn-ghost flex-1" disabled={!!act.busy} onClick={() => act.run('d', async () => onState(await api(`/api/hardship/${h.id}/decide`, { role: 'lender', approve: false })), t('l.declinedOk'))}>{t('l.notThisTime')}</button>
          </div>
        </div>
      ))}
      <Feedback error={act.error} ok={act.ok} />
    </Card>
  );
}

export function Lender({ s, onState }: { s: State; onState: (s: State) => void }) {
  const { t } = useI18n();
  const loan = s.loan;
  const paused = loan?.terms.paused_until && s.week <= loan.terms.paused_until;
  return (
    <div className="space-y-5">
      <Notifications s={s} role="lender" />
      <PaidOff s={s} />
      <PendingHardship s={s} onState={onState} />
      {s.review?.status === 'open' && <ReviewCard s={s} role="lender" onState={onState} />}
      {loan && (
        <Card id="status" title={t('l.yourLoan')}>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <ProgressRing value={loan.repaid_cents} total={loan.terms.principal_cents} size={150} label={t('repaid')} />
            <dl className="grid w-full flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
              <div><dt className="label">{t('l.lent')}</dt><dd className="font-display text-2xl font-semibold num">{fmt(loan.terms.principal_cents)}</dd></div>
              <div><dt className="label">{t('l.back')}</dt><dd className="font-display text-2xl font-semibold text-accent num">{fmt(loan.repaid_cents)}</dd></div>
              <div><dt className="label">{t('remaining')}</dt><dd className="font-display text-2xl font-semibold num">{fmt(loan.remaining_cents)}</dd></div>
              <div><dt className="label">{t('l.status')}</dt><dd className="mt-1"><Pill tone={loan.status === 'active' ? 'ok' : 'neutral'}>{paused ? t('l.pausedTo', { week: loan.terms.paused_until! }) : t(`ls.${loan.status}`, {}, loan.status)}</Pill></dd></div>
            </dl>
          </div>
        </Card>
      )}
      {!s.agreement && <Card title={t('l.nothing')}><Empty icon={<Heart />} title={t('l.noReq')} text={t('l.noReqText')} /></Card>}
      {s.agreement && <AgreementCard key={s.agreement.terms_hash} s={s} role="lender" onState={onState} />}
      {s.agreement?.active && !loan && <FundCard s={s} onState={onState} />}
      {s.agreement?.active && <FallbackCard s={s} role="lender" onState={onState} />}
      {loan && <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0"><Timeline s={s} /><PayoutsCard s={s} onState={onState} /></div>}
      {s.hardships.some((h) => h.status !== 'pending') && <HardshipList s={{ ...s, hardships: s.hardships.filter((h) => h.status !== 'pending') }} />}
      {loan?.status === 'active' && !s.hardships.length && <p className="flex items-center gap-2 text-sm text-muted"><Check width={16} height={16} className="text-accent" />{t('l.noPending')}</p>}
    </div>
  );
}
