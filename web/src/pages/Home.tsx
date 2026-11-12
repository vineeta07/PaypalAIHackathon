import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fmt, fmt0 } from '../api';
import { useI18n } from '../i18n';
import { useTour } from '../components/Tour';
import { Avatar, Arrow, Compass, Pen, Users, Card2, Split, Shield, Spark, Lock, Pause, Chevron, Check, Clock, Heart } from '../components/Icons';

// Terms of the seeded demo agreement (same numbers the engine uses for "$300, earns $40–120").
const DEMO = { min: 3000, good: 10000, normalBps: 1500, goodBps: 2000, cap: 2000 };
function weekSplit(income: number) {
  if (income < DEMO.min) return { lender: 0, bps: 0, kind: 'below' as const, capped: false };
  const bps = income >= DEMO.good ? DEMO.goodBps : DEMO.normalBps;
  const raw = Math.floor((income * bps) / 10000);
  return { lender: Math.min(raw, DEMO.cap), bps, kind: income >= DEMO.good ? 'good' as const : 'normal' as const, capped: raw > DEMO.cap };
}

function Section({ eyebrow, title, children, id }: { eyebrow: string; title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-12">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="mt-2 max-w-2xl text-2xl font-semibold sm:text-[28px] sm:leading-tight">{title}</h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function PaymentPreview() {
  const { t } = useI18n();
  return (
    <div className="card w-full max-w-sm overflow-hidden shadow-pop" aria-hidden="true">
      <div className="flex items-center justify-between border-b border-line bg-subtle px-5 py-3">
        <span className="flex items-center gap-2 text-sm font-medium"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-accentsoft text-accent"><Check width={14} height={14} strokeWidth={2.5} /></span>{t('home.preview.title')}</span>
        <span className="text-xs text-muted">{t('home.preview.via')}</span>
      </div>
      <div className="px-5 py-4">
        <p className="text-3xl font-semibold tracking-tight num">{fmt(4000)}</p>
        <p className="mt-0.5 text-sm text-muted">{t('prod.choc-cake')}</p>
        <div className="mt-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2"><Avatar who="lender" size={22} /><span className="truncate">{t('home.preview.toLender')}</span></span><span className="font-semibold num">{fmt(600)}</span></div>
          <div className="flex items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2"><Avatar who="borrower" size={22} /><span className="truncate">{t('home.preview.toBorrower')}</span></span><span className="font-semibold num">{fmt(3400)}</span></div>
        </div>
        <div className="mt-4 flex h-2 overflow-hidden rounded-full"><span className="bg-[rgb(45_70_112)] dark:bg-info" style={{ width: '15%' }} /><span className="flex-1 bg-accent" /></div>
        <p className="mt-3 rounded-lg bg-subtle px-3 py-2 text-xs leading-relaxed text-muted">{t('home.preview.reason', { total: fmt(8500) })}</p>
      </div>
    </div>
  );
}

function Calculator() {
  const { t } = useI18n();
  const [income, setIncome] = useState(8500);
  const r = weekSplit(income);
  const why = r.kind === 'below' ? t('home.calc.below', { min: fmt0(DEMO.min) }) : t(`home.calc.${r.kind}`, { pct: `${r.bps / 100}%` }) + (r.capped ? t('home.calc.cap', { cap: fmt0(DEMO.cap) }) : '');
  return (
    <div className="card grid gap-0 overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      <div className="p-6 sm:p-8">
        <label htmlFor="calc" className="label">{t('home.calc.income')}</label>
        <p className="mt-1 text-4xl font-semibold tracking-tight num">{fmt0(income)}</p>
        <input id="calc" type="range" min={0} max={20000} step={500} value={income} onChange={(e) => setIncome(Number(e.target.value))} className="mt-5 w-full accent-[rgb(var(--accent))]" aria-valuetext={fmt0(income)} />
        <div className="mt-1 flex justify-between text-xs text-muted num"><span>{fmt0(0)}</span><span>{fmt0(DEMO.min)}</span><span>{fmt0(DEMO.good)}</span><span>{fmt0(20000)}</span></div>
        <p className="mt-6 text-xs text-muted">{t('home.calc.terms', { min: fmt0(DEMO.min), good: fmt0(DEMO.good), cap: fmt0(DEMO.cap) })}</p>
      </div>
      <div className="border-t border-line bg-subtle p-6 sm:p-8 lg:border-l lg:border-t-0" aria-live="polite">
        <dl className="grid grid-cols-2 gap-4">
          <div><dt className="label">{t('home.calc.toLender')}</dt><dd className={`mt-1 text-2xl font-semibold num ${r.lender ? '' : 'text-muted'}`}>{fmt(r.lender)}</dd></div>
          <div><dt className="label">{t('home.calc.toBorrower')}</dt><dd className="mt-1 text-2xl font-semibold text-accent num">{fmt(income - r.lender)}</dd></div>
        </dl>
        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-line">{income > 0 && <><span className="bg-[rgb(45_70_112)] dark:bg-info" style={{ width: `${(r.lender / income) * 100}%` }} /><span className="flex-1 bg-accent" /></>}</div>
        <p className={`mt-4 flex gap-2 rounded-lg border px-3 py-2.5 text-sm ${r.kind === 'below' ? 'border-warm/25 bg-warmsoft text-warm' : 'border-line bg-card text-ink'}`}>{r.kind === 'below' ? <Pause width={16} height={16} className="mt-0.5 shrink-0" /> : <Split width={16} height={16} className="mt-0.5 shrink-0 text-accent" />}<span>{why}</span></p>
      </div>
    </div>
  );
}

export function Home() {
  const { t } = useI18n();
  const nav = useNavigate();
  const { start } = useTour();
  const steps = [[Pen, 's1'], [Users, 's2'], [Card2, 's3'], [Split, 's4']] as const;
  const problems = [[Clock, 'p1'], [Heart, 'p2'], [Pause, 'p3']] as const;
  const safety = [[Spark, 'f1'], [Shield, 'f2'], [Pause, 'f3'], [Lock, 'f4']] as const;
  const people = [{ who: 'borrower' as const, to: '/borrower' }, { who: 'lender' as const, to: '/lender' }, { who: 'customer' as const, to: '/pay/ravi' }];
  return (
    <div className="space-y-12 pb-8">
      <section data-tour="hero" className="grid items-center gap-10 pt-2 xl:grid-cols-[1.25fr_1fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-muted"><span className="h-1.5 w-1.5 rounded-full bg-accent" />{t('home.eyebrow')}</p>
          <h1 className="mt-5 text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-5xl">{t('home.title')}</h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">{t('home.lead')}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button className="btn-primary !px-5 text-[15px]" onClick={start}><Compass width={18} height={18} />{t('home.ctaTour')}</button>
            <button className="btn-ghost !px-5 text-[15px]" onClick={() => nav('/borrower')}>{t('home.ctaStart')}<Arrow width={16} height={16} /></button>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {(['home.trust1', 'home.trust2', 'home.trust3'] as const).map((k) => <li key={k} className="flex items-center gap-2"><Check width={15} height={15} className="text-accent" />{t(k)}</li>)}
          </ul>
        </div>
        <div className="flex justify-center xl:justify-end"><PaymentPreview /></div>
      </section>

      <Section eyebrow={t('home.problem.eyebrow')} title={t('home.problem.title')} id="h-problem">
        <div className="grid gap-4 md:grid-cols-3">
          {problems.map(([Icon, k]) => (
            <div key={k} className="card p-5"><Icon width={20} height={20} className="text-warm" /><p className="mt-3 font-semibold">{t(`home.${k}.t`)}</p><p className="mt-1.5 text-sm leading-relaxed text-muted">{t(`home.${k}.b`)}</p></div>
          ))}
        </div>
      </Section>

      <Section eyebrow={t('home.how.eyebrow')} title={t('home.how.title')} id="h-how">
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map(([Icon, k], i) => (
            <li key={k} className="card relative p-5">
              <div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accentsoft text-accent"><Icon width={18} height={18} /></span><span className="text-xs font-semibold text-muted num">0{i + 1}</span></div>
              <p className="mt-4 font-semibold">{t(`home.${k}.t`)}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(`home.${k}.b`)}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section eyebrow={t('home.calc.eyebrow')} title={t('home.calc.title')} id="h-calc">
        <p className="-mt-4 mb-6 max-w-2xl text-muted">{t('home.calc.lead')}</p>
        <Calculator />
      </Section>

      <Section eyebrow={t('home.safety.eyebrow')} title={t('home.safety.title')} id="h-safety">
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {safety.map(([Icon, k]) => (
            <div key={k} className="flex gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-card text-accent"><Icon width={18} height={18} /></span><div><p className="font-semibold">{t(`home.${k}.t`)}</p><p className="mt-1 text-sm leading-relaxed text-muted">{t(`home.${k}.b`)}</p></div></div>
          ))}
        </div>
      </Section>

      <Section eyebrow={t('home.who.eyebrow')} title={t('home.who.title')} id="h-who">
        <div className="grid gap-4 md:grid-cols-3">
          {people.map((p) => (
            <Link key={p.who} to={p.to} className="card group flex flex-col gap-3 p-5 transition-colors hover:border-accent/40">
              <Avatar who={p.who} size={40} />
              <span className="font-semibold">{t(`persona.${p.who}.title`)}</span>
              <span className="text-sm leading-relaxed text-muted">{t(`persona.${p.who}.text`)}</span>
              <span className="mt-auto flex items-center gap-1 pt-2 text-sm font-medium text-accent">{t('open').replace('→', '').trim()}<Arrow width={15} height={15} className="transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
        </div>
      </Section>

      <Section eyebrow={t('home.faq.eyebrow')} title={t('home.faq.title')} id="h-faq">
        <div className="card divide-y divide-line">
          {[1, 2, 3, 4, 5].map((n) => (
            <details key={n} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium">{t(`faq.q${n}`)}<Chevron width={16} height={16} className="shrink-0 text-muted transition-transform group-open:rotate-90" /></summary>
              <p className="pb-4 text-sm leading-relaxed text-muted">{t(`faq.a${n}`)}</p>
            </details>
          ))}
        </div>
      </Section>

      <footer className="border-t border-line pt-6 text-sm text-muted">
        <p>{t('home.footer')}</p>
        <p className="mt-1">{t('home.footer2')}</p>
      </footer>
    </div>
  );
}
