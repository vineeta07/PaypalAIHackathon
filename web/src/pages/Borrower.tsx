import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, fmt, fmt0, type State } from '../api';
import { Card, Pill, ProgressRing, Bar, useAction, Feedback, Spinner, Empty } from '../components/ui';
import { AgreementCard } from '../components/Agreement';
import { FallbackCard, PayoutsCard, Timeline, PaidOff, Notifications } from '../components/Panels';
import { Spark, Pause, Close, Calendar } from '../components/Icons';

const EXAMPLE = 'I need $300 for a new oven, I earn about $40–120 a week from cake orders.';

export function RequestCard({ s, onState }: { s: State; onState: (s: State) => void }) {
  const [text, setText] = useState(EXAMPLE);
  const act = useAction();
  return (
    <Card id="request" title={<span className="flex items-center gap-2"><Spark className="text-accent" />Ask for a loan</span>}>
      <p className="text-sm text-muted">Say what you need in your own words. FairLoop's assistant checks it against your last 8 weeks of sales and drafts fair terms. Nothing happens until you and {s.personas.lender.name} both approve.</p>
      <form className="mt-4" onSubmit={(e) => { e.preventDefault(); act.run('req', async () => onState(await api('/api/loan/request', { text }))); }}>
        <label htmlFor="req" className="label">What do you need, and what do you usually earn?</label>
        <textarea id="req" rows={3} value={text} onChange={(e) => setText(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-paper p-3 leading-relaxed" maxLength={1500} />
        <button className="btn-primary mt-3 w-full sm:w-auto" disabled={!!act.busy || !text.trim()}>{act.busy ? <><Spinner />Drafting a fair agreement…</> : 'Draft my agreement'}</button>
      </form>
      {s.request?.follow_up_question && !s.agreement && <p className="mt-4 rounded-xl bg-accentsoft px-4 py-3 text-sm" role="status"><span className="font-semibold">One question: </span>{s.request.follow_up_question}</p>}
      <Feedback error={act.error} ok={act.ok} />
    </Card>
  );
}

function HardshipDrawer({ s, onState, onClose }: { s: State; onState: (s: State) => void; onClose: () => void }) {
  const [text, setText] = useState('I was sick this week, can I pause for 2 weeks?');
  const act = useAction();
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div role="dialog" aria-modal="true" aria-labelledby="hs-t" className="card w-full max-w-lg rounded-b-none p-6 sm:rounded-xl2" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3"><h2 id="hs-t" className="font-display text-xl font-semibold">Ask {s.personas.lender.name} for some room</h2><button className="btn-ghost !min-h-[44px] !px-3" onClick={onClose} aria-label="Close"><Close /></button></div>
        <p className="mt-2 text-sm text-muted">Explain in your own words. The assistant turns it into a clear request (pause, lower share, longer term, small fixed amount, or partial forgiveness). {s.personas.lender.name} decides. Your terms can never get harsher automatically.</p>
        <form className="mt-4" onSubmit={(e) => { e.preventDefault(); act.run('h', async () => { onState(await api('/api/hardship/request', { text })); onClose(); }); }}>
          <label htmlFor="hs" className="label">What's going on?</label>
          <textarea id="hs" autoFocus rows={3} value={text} onChange={(e) => setText(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-paper p-3" maxLength={1000} />
          <button className="btn-primary mt-3 w-full" disabled={!!act.busy || !text.trim()}>{act.busy && <Spinner />}Send request to {s.personas.lender.name}</button>
        </form>
        <Feedback error={act.error} ok={act.ok} />
      </motion.div>
    </motion.div>
  );
}

export function SimulateWeek({ s, onState }: { s: State; onState: (s: State) => void }) {
  const act = useAction();
  const modes = [['low', 'Slow week ($21)'], ['normal', 'Normal week ($79)'], ['good', 'Great week ($128)'], ['zero', 'No sales ($0)']] as const;
  return (
    <Card id="simulate" title={<span className="flex items-center gap-2"><Calendar className="text-warm" />Simulate a week</span>} action={<Pill tone="warn">Demo only</Pill>}>
      <p className="text-sm text-muted">Adds simulated customer payments to <span className="font-semibold text-ink">{s.week}</span>, runs them through the same engine, then moves the demo clock to next week.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {modes.map(([m, l]) => <button key={m} className="btn-ghost text-sm" disabled={!!act.busy || !s.loan} onClick={() => act.run(m, async () => onState(await api('/api/simulate/week', { mode: m })), 'Week closed.')}>{act.busy === m && <Spinner />}{l}</button>)}
      </div>
      {!s.loan && <p className="mt-3 text-xs text-muted">Available once the loan is funded.</p>}
      <Feedback error={act.error} ok={act.ok} />
    </Card>
  );
}

export function Borrower({ s, onState }: { s: State; onState: (s: State) => void }) {
  const [hardship, setHardship] = useState(false);
  const loan = s.loan;
  const wk = loan?.weeks[s.week];
  const pending = s.hardships.filter((h) => h.status === 'pending');
  return (
    <div className="space-y-5">
      <Notifications s={s} role="borrower" />
      <PaidOff s={s} />
      {loan && loan.status === 'active' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card id="progress" title="Your loan from Maya" className="lg:col-span-1">
            <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col">
              <ProgressRing value={loan.repaid_cents} total={loan.terms.principal_cents} />
              <dl className="grid w-full grid-cols-2 gap-3 text-center sm:text-left lg:text-center">
                <div><dt className="label">Repaid</dt><dd className="font-display text-2xl font-semibold text-accent num">{fmt(loan.repaid_cents)}</dd></div>
                <div><dt className="label">Remaining</dt><dd className="font-display text-2xl font-semibold num">{fmt(loan.remaining_cents)}</dd></div>
              </dl>
            </div>
          </Card>
          <Card id="week" title={`This week (${s.week})`} className="lg:col-span-2">
            <div className="flex items-baseline justify-between gap-3"><span className="font-display text-3xl font-semibold num">{fmt(wk?.income_cents || 0)}</span><span className="text-sm text-muted">minimum {fmt0(loan.terms.weekly_min_income_cents)}</span></div>
            <div className="mt-3"><Bar value={wk?.income_cents || 0} max={Math.max(loan.terms.weekly_min_income_cents * 3, wk?.income_cents || 0)} marker={loan.terms.weekly_min_income_cents} label="This week's income against the weekly minimum" /></div>
            <p className="mt-2 text-sm text-muted">{loan.terms.paused_until && s.week <= loan.terms.paused_until ? <span className="font-semibold text-warm">Paused until {loan.terms.paused_until}: nothing is taken.</span> : (wk?.income_cents || 0) < loan.terms.weekly_min_income_cents ? `Below the minimum, nothing is taken. ${fmt(loan.terms.weekly_min_income_cents - (wk?.income_cents || 0))} more in sales and repayments start.` : `Taken this week: ${fmt(wk?.deducted_cents || 0)} of the ${fmt0(loan.terms.weekly_cap_cents)} cap.`}</p>
            {s.preview && <div className="mt-4 rounded-xl bg-paper p-4"><p className="label">Next deduction preview, for a {fmt0(s.preview.sample_cents)} cake order</p><p className="mt-1 font-semibold">{s.preview.decision.reason}</p></div>}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button className="btn-warn flex-1" onClick={() => setHardship(true)}><Pause width={18} height={18} />I'm having a hard week</button>
              <a className="btn-ghost flex-1" href="/pay/ravi">Open my pay page</a>
            </div>
            {pending.length > 0 && <p className="mt-3 text-sm text-muted" role="status">Waiting for {s.personas.lender.name}: {pending[0].request.summary}</p>}
          </Card>
        </div>
      )}
      {!s.agreement && <RequestCard s={s} onState={onState} />}
      {s.agreement && <AgreementCard key={s.agreement.terms_hash} s={s} role="borrower" onState={onState} />}
      {s.agreement?.active && <FallbackCard s={s} role="borrower" onState={onState} />}
      {s.agreement?.active && !loan && <Card title="Waiting for Maya"><Empty icon={<Spark />} title="Agreement active" text={`Once ${s.personas.lender.name} funds the loan with PayPal, FairLoop sends the money straight to your PayPal account.`} /></Card>}
      {s.review?.status === 'open' && <ReviewCard s={s} role="borrower" onState={onState} />}
      {loan && <div className="grid gap-5 lg:grid-cols-2"><Timeline s={s} /><div className="space-y-5"><SimulateWeek s={s} onState={onState} /><PayoutsCard s={s} onState={onState} /></div></div>}
      {s.hardships.length > 0 && <HardshipList s={s} />}
      <AnimatePresence>{hardship && <HardshipDrawer s={s} onState={onState} onClose={() => setHardship(false)} />}</AnimatePresence>
    </div>
  );
}

export function HardshipList({ s }: { s: State }) {
  return (
    <Card id="hardships" title="Hardship requests">
      <ul className="space-y-3">{s.hardships.map((h) => (
        <li key={h.id} className="rounded-xl border border-line p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{h.request.summary}</span><Pill tone={h.status === 'approved' ? 'ok' : h.status === 'denied' ? 'danger' : 'warn'}>{h.status}</Pill></div><p className="mt-1 text-sm text-muted">"{h.text}" · parsed by {h.ai === 'gemini' ? 'Gemini' : 'offline rules'}</p></li>
      ))}</ul>
    </Card>
  );
}

export function ReviewCard({ s, role, onState }: { s: State; role: 'lender' | 'borrower'; onState: (s: State) => void }) {
  const r = s.review!; const act = useAction();
  return (
    <Card id="review" title="Time for a check-in" action={<Pill tone="warn">{r.low_weeks} low weeks</Pill>}>
      <p className="text-sm text-muted">Sales have been below the minimum for {r.low_weeks} weeks in a row. Here are some gentler options. Nothing changes until you both pick the same one.</p>
      <ul className="mt-4 space-y-2">{r.options.map((o, i) => (
        <li key={i} className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-center">
          <span className="flex-1">{o.summary}</span>
          <span className="flex gap-1 text-xs">{r.approvals.borrower === i && <Pill tone="ok">Ravi</Pill>}{r.approvals.lender === i && <Pill tone="ok">Maya</Pill>}</span>
          <button className="btn-ghost text-sm" disabled={!!act.busy || r.approvals[role] === i} onClick={() => act.run(`o${i}`, async () => onState(await api('/api/review/approve', { role, option: i })))}>{r.approvals[role] === i ? 'Your choice' : 'Choose'}</button>
        </li>
      ))}</ul>
      <Feedback error={act.error} ok={act.ok} />
    </Card>
  );
}
