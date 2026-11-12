import { api, fmt, type State } from '../api';
import { Card, Pill, ProgressRing, useAction, Feedback, Spinner, Empty } from '../components/ui';
import { AgreementCard } from '../components/Agreement';
import { FallbackCard, FundCard, PayoutsCard, Timeline, PaidOff, Notifications } from '../components/Panels';
import { ReviewCard, HardshipList } from './Borrower';
import { Heart, Check } from '../components/Icons';

function PendingHardship({ s, onState }: { s: State; onState: (s: State) => void }) {
  const act = useAction();
  const pending = s.hardships.filter((h) => h.status === 'pending');
  if (!pending.length) return null;
  return (
    <Card id="pending" title="Ravi is asking for some room" action={<Pill tone="warn">Needs you</Pill>}>
      {pending.map((h) => (
        <div key={h.id} className="rounded-xl bg-paper p-4">
          <p className="text-sm text-muted">Ravi wrote: "{h.text}"</p>
          <p className="mt-2 text-lg font-semibold">{h.request.summary}</p>
          <p className="mt-1 text-xs text-muted">Structured by {h.ai === 'gemini' ? 'Gemini' : 'offline rules'}. Only gentler terms can be applied; the engine blocks anything harsher.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button className="btn-primary flex-1" disabled={!!act.busy} onClick={() => act.run('a', async () => onState(await api(`/api/hardship/${h.id}/decide`, { role: 'lender', approve: true })), 'Approved. Ravi has been told.')}>{act.busy === 'a' && <Spinner />}Approve</button>
            <button className="btn-ghost flex-1" disabled={!!act.busy} onClick={() => act.run('d', async () => onState(await api(`/api/hardship/${h.id}/decide`, { role: 'lender', approve: false })), 'Declined. Terms stay the same.')}>Not this time</button>
          </div>
        </div>
      ))}
      <Feedback error={act.error} ok={act.ok} />
    </Card>
  );
}

export function Lender({ s, onState }: { s: State; onState: (s: State) => void }) {
  const loan = s.loan;
  return (
    <div className="space-y-5">
      <Notifications s={s} role="lender" />
      <PaidOff s={s} />
      <PendingHardship s={s} onState={onState} />
      {s.review?.status === 'open' && <ReviewCard s={s} role="lender" onState={onState} />}
      {loan && (
        <Card id="status" title="Your loan to Ravi">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <ProgressRing value={loan.repaid_cents} total={loan.terms.principal_cents} size={150} />
            <dl className="grid w-full flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
              <div><dt className="label">Lent</dt><dd className="font-display text-2xl font-semibold num">{fmt(loan.terms.principal_cents)}</dd></div>
              <div><dt className="label">Back to you</dt><dd className="font-display text-2xl font-semibold text-accent num">{fmt(loan.repaid_cents)}</dd></div>
              <div><dt className="label">Remaining</dt><dd className="font-display text-2xl font-semibold num">{fmt(loan.remaining_cents)}</dd></div>
              <div><dt className="label">Status</dt><dd className="mt-1"><Pill tone={loan.status === 'active' ? 'ok' : 'neutral'}>{loan.terms.paused_until && s.week <= loan.terms.paused_until ? `Paused to ${loan.terms.paused_until}` : loan.status}</Pill></dd></div>
            </dl>
          </div>
        </Card>
      )}
      {!s.agreement && <Card title="Nothing to review yet"><Empty icon={<Heart />} title="No loan request yet" text="When Ravi asks for a loan, the draft agreement and its affordability check appear here for you to approve or change." /></Card>}
      {s.agreement && <AgreementCard key={s.agreement.terms_hash} s={s} role="lender" onState={onState} />}
      {s.agreement?.active && !loan && <FundCard s={s} onState={onState} />}
      {s.agreement?.active && <FallbackCard s={s} role="lender" onState={onState} />}
      {loan && <div className="grid gap-5 lg:grid-cols-2"><Timeline s={s} /><PayoutsCard s={s} onState={onState} /></div>}
      {s.hardships.some((h) => h.status !== 'pending') && <HardshipList s={{ ...s, hardships: s.hardships.filter((h) => h.status !== 'pending') }} />}
      {loan?.status === 'active' && !s.hardships.length && <p className="flex items-center gap-2 text-sm text-muted"><Check width={16} height={16} className="text-accent" />No pending approvals.</p>}
    </div>
  );
}
