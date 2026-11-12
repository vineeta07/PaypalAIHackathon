import { useState, type ReactNode } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { api, fmt, fmt0, pct, type State, type Affordability } from '../api';
import { useI18n, LANGS } from '../i18n';
import { Card, Pill, useAction, Feedback, Spinner } from './ui';
import { Avatar, Check, Clock, Lock } from './Icons';

export function PayoffChart({ a }: { a: Affordability }) {
  const { t } = useI18n();
  const len = Math.min(60, Math.max(...a.scenarios.map((s) => s.series.length)));
  const data = Array.from({ length: len }, (_, i) => ({ week: i, ...Object.fromEntries(a.scenarios.map((s) => [pct(s.share_bps), (s.series[Math.min(i, s.series.length - 1)] ?? 0) / 100])) }));
  const colors = ['rgb(var(--muted))', 'rgb(var(--accent))', 'rgb(var(--warm))'];
  return (
    <figure>
      <div className="h-44 w-full" aria-hidden="true">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 3" />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} />
            <YAxis tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} tickFormatter={(v) => `$${v}`} />
            <Tooltip formatter={(v: number) => fmt(Math.round(v * 100))} labelFormatter={(w) => t('ch.week', { n: w })} contentStyle={{ background: 'rgb(var(--card))', border: '1px solid rgb(var(--line))', borderRadius: 10 }} />
            <ReferenceLine x={52} stroke="rgb(var(--danger))" strokeDasharray="4 4" />
            {a.scenarios.map((s, i) => <Line key={s.share_bps} type="monotone" dataKey={pct(s.share_bps)} stroke={colors[i]} strokeWidth={i === 1 ? 2.5 : 1.5} dot={false} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
        {a.scenarios.map((s) => <span key={s.share_bps} className="rounded-full border border-line px-2 py-0.5 num">{t('ch.share', { pct: pct(s.share_bps), weeks: s.weeks ? t('ag.termVal', { n: s.weeks }) : t('ag.termVal', { n: '52+' }) })}</span>)}
      </figcaption>
    </figure>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (<div className="flex items-baseline justify-between gap-3 border-b border-line/60 py-2 last:border-0"><dt className="text-sm text-muted">{k}</dt><dd className="text-right font-semibold num">{v}</dd></div>);
}

export function AgreementCard({ s, role, onState }: { s: State; role: 'lender' | 'borrower'; onState: (s: State) => void }) {
  const { t, lang } = useI18n();
  const a = s.agreement!;
  const tm = a.terms;
  const act = useAction();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ amount: String(tm.principal_cents / 100), share: String((tm.tiers[0]?.share_bps ?? 1500) / 100), min: String(tm.weekly_min_income_cents / 100), cap: String(tm.weekly_cap_cents / 100), term: String(tm.term_weeks) });
  const funded = !!s.loan;
  const aff = a.affordability || s.request?.affordability;
  const people: ('lender' | 'borrower')[] = ['borrower', 'lender'];
  const other = role === 'lender' ? 'borrower' : 'lender';
  const sameLang = (a.summary_lang || 'en') === lang;
  const summary = sameLang ? a.summary : (a.summaries?.[lang] ?? a.summary);
  const save = () => act.run('edit', async () => {
    const share = Math.round(Number(draft.share) * 100);
    const n = await api('/api/agreement/edit', { role, changes: { principal_cents: Math.round(Number(draft.amount) * 100), weekly_min_income_cents: Math.round(Number(draft.min) * 100), weekly_cap_cents: Math.round(Number(draft.cap) * 100), term_weeks: Number(draft.term), tiers: tm.tiers.map((x, i) => ({ ...x, share_bps: i === 0 ? share : Math.max(share, x.share_bps) })) } });
    onState(n); setEditing(false);
  }, t('ag.editOk'));
  const notes = [...(a.notes || []), ...(a.ai_notes || [])].filter((v, i, arr) => arr.indexOf(v) === i);
  const warning = aff?.warning ? t('ag.warning', { time: aff.payoff_weeks ? t('ag.termVal', { n: aff.payoff_weeks }) : t('ag.over3y'), amount: fmt(aff.suggested_principal_cents || 0) }) : null;
  return (
    <Card id="agreement" title={<span>{t('ag.title')} <span className="font-sans text-sm font-normal text-muted">v{a.version}</span></span>} action={a.active ? <Pill tone="ok"><Check width={14} height={14} />{t('ag.active')}</Pill> : <Pill tone="warn"><Clock width={14} height={14} />{t('ag.awaiting')}</Pill>}>
      <p className="font-display text-4xl font-semibold num">{fmt0(tm.principal_cents)} <span className="font-sans text-base font-medium text-accent">{t('ag.interest')}</span></p>
      <p className="mt-3 leading-relaxed">{summary}</p>
      {!sameLang && a.summaries?.[lang] && s.request?.ai === 'gemini' && <p className="mt-2 text-xs text-muted">{t('ag.aiLang', { lang: LANGS.find((l) => l.code === lang)!.label })}</p>}
      {notes.length > 0 && <ul className="mt-3 space-y-1 text-sm text-warm">{notes.map((n) => <li key={n}>• {n}</li>)}</ul>}
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <dl>
          {tm.tiers.map((x) => <Row key={x.min_weekly_cents} k={t('ag.shareIn', { amount: fmt0(x.min_weekly_cents) })} v={pct(x.share_bps)} />)}
          <Row k={t('ag.min')} v={fmt0(tm.weekly_min_income_cents)} />
          <Row k={t('ag.cap')} v={fmt0(tm.weekly_cap_cents)} />
          <Row k={t('ag.term')} v={`${t('ag.termVal', { n: tm.term_weeks })}${s.loan ? t('ag.ends', { week: s.loan.end_week }) : ''}`} />
          <Row k={t('ag.eot')} v={tm.end_of_term_action === 'review' ? t('ag.eotReview') : t('ag.eotForgive')} />
          <Row k={t('ag.pause')} v={tm.paused_until ? t('ag.pausedUntil', { week: tm.paused_until }) : t('ag.askAnytime')} />
          <Row k={t('ag.fallback')} v={t('ag.fallbackVal', { amount: fmt(tm.fallback_weekly_cents) })} />
        </dl>
        {aff && (<div><p className="label mb-2">{t('ag.projected')}</p><PayoffChart a={aff} />{warning && <p className="mt-3 rounded-xl bg-warmsoft px-3 py-2 text-sm text-warm" role="status">{warning}</p>}</div>)}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {people.map((p) => (
          <div key={p} className={`flex items-center gap-3 rounded-xl border p-3 ${a.approvals[p] ? 'border-accent/40 bg-accentsoft/60' : 'border-line'}`}>
            <Avatar who={p} size={36} />
            <div className="min-w-0 flex-1"><p className="font-semibold">{s.personas[p].name}</p><p className="text-sm text-muted">{a.approvals[p] ? t('ag.approved') : t('ag.notYet')}</p></div>
            {a.approvals[p] ? <Check className="text-accent" /> : <Clock className="text-muted" />}
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-start gap-2 break-all text-xs text-muted"><Lock width={14} height={14} className="mt-0.5 shrink-0" /><span>{t('ag.hash')} <code className="num">{a.terms_hash}</code></span></p>
      {!funded && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button className="btn-primary flex-1" disabled={!!a.approvals[role] || !!act.busy} onClick={() => act.run('approve', async () => onState(await api('/api/agreement/approve', { role })), a.approvals[other] ? t('ag.bothOk') : t('ag.waitOther'))}>
            {act.busy === 'approve' && <Spinner />}{a.approvals[role] ? t('ag.approvedAs', { name: s.personas[role].name }) : t('ag.approveAs', { name: s.personas[role].name })}
          </button>
          <button className="btn-ghost flex-1" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>{t('ag.propose')}</button>
        </div>
      )}
      {editing && !funded && (
        <form className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
          {(['amount', 'share', 'min', 'cap', 'term'] as const).map((k) => (
            <label key={k} className="flex flex-col gap-1 text-sm"><span className="label">{t(`ag.f.${k}`)}</span><input inputMode="decimal" className="min-h-[44px] w-full rounded-xl border border-line bg-paper px-3 num" value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} /></label>
          ))}
          <button className="btn-primary col-span-2 sm:col-span-5" disabled={!!act.busy}>{act.busy === 'edit' && <Spinner />}{t('ag.send')}</button>
        </form>
      )}
      <Feedback error={act.error} ok={act.ok} />
    </Card>
  );
}
