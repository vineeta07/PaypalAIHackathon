import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, fmt, fmt0, type State } from '../api';
import { useI18n } from '../i18n';
import { hardshipLabel, reasonText } from '../text';
import { Card, Pill, ProgressRing, Bar, useAction, Feedback, Spinner, Empty, Stat } from '../components/ui';
import { AgreementCard } from '../components/Agreement';
import { FallbackCard, PayoutsCard, Timeline, PaidOff, Notifications } from '../components/Panels';
import { Spark, Pause, Close, Calendar } from '../components/Icons';

export function RequestCard({ s, onState, tour }: { s: State; onState: (s: State) => void; tour?: string }) {
  const { t, lang } = useI18n();
  const [edited, setEdited] = useState<string | null>(null);
  const text = edited ?? t('req.example');
  const act = useAction();
  const lender = s.personas.lender.name;
  return (
    <Card id="request" tour={tour} title={<span className="flex items-center gap-2"><Spark className="text-accent" />{t('req.title')}</span>}>
      <p className="text-sm text-muted">{t('req.intro', { lender })}</p>
      <form className="mt-4" onSubmit={(e) => { e.preventDefault(); act.run('req', async () => onState(await api('/api/loan/request', { text, lang }))); }}>
        <label htmlFor="req" className="label">{t('req.label')}</label>
        <textarea id="req" rows={3} value={text} onChange={(e) => setEdited(e.target.value)} className="input mt-1 py-2.5 leading-relaxed" maxLength={1500} />
        <button className="btn-primary mt-3 w-full sm:w-auto" disabled={!!act.busy || !text.trim()}>{act.busy ? <><Spinner />{t('req.busy')}</> : t('req.button')}</button>
      </form>
      {s.request?.follow_up_question && !s.agreement && <p className="mt-4 rounded-lg border border-accent/20 bg-accentsoft px-4 py-3 text-sm" role="status"><span className="font-semibold">{t('req.oneQ')} </span>{s.request.ai === 'gemini' ? s.request.follow_up_question : t('req.followup')}</p>}
      <Feedback error={act.error} ok={act.ok} />
    </Card>
  );
}

function HardshipDrawer({ s, onState, onClose }: { s: State; onState: (s: State) => void; onClose: () => void }) {
  const { t, lang } = useI18n();
  const [text, setText] = useState(t('hs.example'));
  const act = useAction();
  const lender = s.personas.lender.name;
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div role="dialog" aria-modal="true" aria-labelledby="hs-t" className="card w-full max-w-lg rounded-b-none p-6 shadow-pop sm:rounded-xl2" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3"><h2 id="hs-t" className="text-lg font-semibold">{t('hs.title', { lender })}</h2><button className="btn-ghost !min-h-[44px] !px-3" onClick={onClose} aria-label={t('close')}><Close /></button></div>
        <p className="mt-2 text-sm text-muted">{t('hs.intro', { lender })}</p>
        <form className="mt-4" onSubmit={(e) => { e.preventDefault(); act.run('h', async () => { onState(await api('/api/hardship/request', { text, lang })); onClose(); }); }}>
          <label htmlFor="hs" className="label">{t('hs.label')}</label>
          <textarea id="hs" autoFocus rows={3} value={text} onChange={(e) => setText(e.target.value)} className="input mt-1 py-2.5" maxLength={1000} />
          <button className="btn-primary mt-3 w-full" disabled={!!act.busy || !text.trim()}>{act.busy && <Spinner />}{t('hs.send', { lender })}</button>
        </form>
        <Feedback error={act.error} ok={act.ok} />
      </motion.div>
    </motion.div>
  );
}

export function SimulateWeek({ s, onState }: { s: State; onState: (s: State) => void }) {
  const { t, lang } = useI18n();
  const act = useAction();
  const modes = [['low', 2100], ['normal', 7900], ['good', 12800], ['zero', 0]] as const;
  return (
    <Card id="simulate" tour="simulate" title={<span className="flex items-center gap-2"><Calendar className="text-warm" />{t('sim.title')}</span>} action={<Pill tone="warn">{t('demoOnly')}</Pill>}>
      <p className="text-sm text-muted">{t('sim.text', { week: s.week })}</p>
      <div className="mt-4 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        {modes.map(([m, c]) => <button key={m} data-mode={m} className="btn-ghost text-sm" disabled={!!act.busy || !s.loan} onClick={() => act.run(m, async () => onState(await api('/api/simulate/week', { mode: m, lang })), t('sim.done'))}>{act.busy === m && <Spinner />}{t(`sim.${m}`, { amount: fmt0(c) })}</button>)}
      </div>
      {!s.loan && <p className="mt-3 text-xs text-muted">{t('sim.after')}</p>}
      <Feedback error={act.error} ok={act.ok} />
    </Card>
  );
}

export function Borrower({ s, onState }: { s: State; onState: (s: State) => void }) {
  const { t } = useI18n();
  const [hardship, setHardship] = useState(false);
  const loan = s.loan;
  const wk = loan?.weeks[s.week];
  const pending = s.hardships.filter((h) => h.status === 'pending');
  const lender = s.personas.lender.name;
  return (
    <div className="space-y-5">
      <Notifications s={s} role="borrower" />
      <PaidOff s={s} />
      {loan && loan.status === 'active' && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat label={t('kpi.borrowed')} value={fmt(loan.terms.principal_cents)} sub={t('b.loanFrom', { lender })} />
          <Stat label={t('kpi.repaid')} value={fmt(loan.repaid_cents)} tone="accent" sub={t('kpi.pct', { pct: Math.round((loan.repaid_cents / loan.terms.principal_cents) * 100) })} />
          <Stat label={t('kpi.remaining')} value={fmt(loan.remaining_cents)} sub={t('kpi.ends', { week: loan.end_week })} />
          <Stat label={t('kpi.thisWeek')} value={fmt(wk?.income_cents || 0)} tone={(wk?.income_cents || 0) < loan.terms.weekly_min_income_cents ? 'warm' : undefined} sub={t('kpi.weekSub', { amount: fmt0(loan.terms.weekly_min_income_cents) })} />
        </div>
      )}
      {loan && loan.status === 'active' && (
        <div className="grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
          <Card id="week" tour="borrower-main" title={t('b.thisWeek', { week: s.week })} className="lg:col-span-2">
            <div className="flex flex-wrap items-baseline justify-between gap-3"><span className="text-3xl font-semibold tracking-tight num">{fmt(wk?.income_cents || 0)}</span><span className="text-sm text-muted">{t('b.minimum', { amount: fmt0(loan.terms.weekly_min_income_cents) })}</span></div>
            <div className="mt-3"><Bar value={wk?.income_cents || 0} max={Math.max(loan.terms.weekly_min_income_cents * 3, wk?.income_cents || 0)} marker={loan.terms.weekly_min_income_cents} label={t('b.meter')} /></div>
            <p className="mt-2 text-sm text-muted">{loan.terms.paused_until && s.week <= loan.terms.paused_until ? <span className="font-semibold text-warm">{t('b.paused', { week: loan.terms.paused_until })}</span> : (wk?.income_cents || 0) < loan.terms.weekly_min_income_cents ? t('b.below', { amount: fmt(loan.terms.weekly_min_income_cents - (wk?.income_cents || 0)) }) : t('b.taken', { amount: fmt(wk?.deducted_cents || 0), cap: fmt0(loan.terms.weekly_cap_cents) })}</p>
            {s.preview && <div className="mt-4 rounded-lg border border-line bg-subtle p-4"><p className="label">{t('b.preview', { amount: fmt0(s.preview.sample_cents) })}</p><p className="mt-1 font-semibold">{reasonText(t, s.preview.decision, lender)}</p></div>}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button className="btn-warn flex-1" onClick={() => setHardship(true)}><Pause width={18} height={18} />{t('b.hardWeek')}</button>
              <a className="btn-ghost flex-1" href="/pay/ravi">{t('b.openPay')}</a>
            </div>
            {pending.length > 0 && <p className="mt-3 text-sm text-muted" role="status">{t('b.waiting', { lender, summary: hardshipLabel(t, pending[0].request) })}</p>}
          </Card>
          <Card id="progress" title={t('b.loanFrom', { lender })}>
            <div className="flex flex-col items-center gap-3 py-2">
              <ProgressRing value={loan.repaid_cents} total={loan.terms.principal_cents} label={t('repaid')} />
              <p className="text-center text-sm text-muted num">{fmt(loan.repaid_cents)} / {fmt(loan.terms.principal_cents)}</p>
            </div>
          </Card>
        </div>
      )}
      {!s.agreement && <RequestCard s={s} onState={onState} tour="borrower-main" />}
      {s.agreement && <AgreementCard key={s.agreement.terms_hash} s={s} role="borrower" onState={onState} tour={loan?.status === 'active' ? undefined : 'borrower-main'} />}
      {s.agreement?.active && <FallbackCard s={s} role="borrower" onState={onState} />}
      {s.agreement?.active && !loan && <Card title={t('b.waitTitle', { lender })}><Empty icon={<Spark />} title={t('b.waitEmpty')} text={t('b.waitText', { lender })} /></Card>}
      {s.review?.status === 'open' && <ReviewCard s={s} role="borrower" onState={onState} />}
      {loan && <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0"><Timeline s={s} /><div className="min-w-0 space-y-5"><SimulateWeek s={s} onState={onState} /><PayoutsCard s={s} onState={onState} /></div></div>}
      {s.hardships.length > 0 && <HardshipList s={s} />}
      <AnimatePresence>{hardship && <HardshipDrawer s={s} onState={onState} onClose={() => setHardship(false)} />}</AnimatePresence>
    </div>
  );
}

export function HardshipList({ s }: { s: State }) {
  const { t } = useI18n();
  return (
    <Card id="hardships" title={t('hl.title')}>
      <ul className="space-y-3">{s.hardships.map((h) => (
        <li key={h.id} className="rounded-xl border border-line p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{hardshipLabel(t, h.request, true)}</span><Pill tone={h.status === 'approved' ? 'ok' : h.status === 'denied' ? 'danger' : 'warn'}>{t(`st.${h.status}`, {}, h.status)}</Pill></div><p className="mt-1 text-sm text-muted">“{h.text}” · {t('hl.parsedBy', { by: h.ai === 'gemini' ? t('ai.gemini') : t('by.rules') })}</p></li>
      ))}</ul>
    </Card>
  );
}

export function ReviewCard({ s, role, onState }: { s: State; role: 'lender' | 'borrower'; onState: (s: State) => void }) {
  const { t } = useI18n();
  const r = s.review!; const act = useAction();
  return (
    <Card id="review" title={t('rv.title')} action={<Pill tone="warn">{t('rv.badge', { n: r.low_weeks })}</Pill>}>
      <p className="text-sm text-muted">{t('rv.text', { n: r.low_weeks })}</p>
      <ul className="mt-4 space-y-2">{r.options.map((o, i) => (
        <li key={i} className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-center">
          <span className="flex-1">{hardshipLabel(t, o)}</span>
          <span className="flex gap-1 text-xs">{r.approvals.borrower === i && <Pill tone="ok">{s.personas.borrower.name}</Pill>}{r.approvals.lender === i && <Pill tone="ok">{s.personas.lender.name}</Pill>}</span>
          <button className="btn-ghost text-sm" disabled={!!act.busy || r.approvals[role] === i} onClick={() => act.run(`o${i}`, async () => onState(await api('/api/review/approve', { role, option: i })))}>{r.approvals[role] === i ? t('rv.yours') : t('rv.choose')}</button>
        </li>
      ))}</ul>
      <Feedback error={act.error} ok={act.ok} />
    </Card>
  );
}
