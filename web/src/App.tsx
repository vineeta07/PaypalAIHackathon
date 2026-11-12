import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, type State } from './api';
import { I18nProvider, useI18n, LANGS, type Lang } from './i18n';
import { Borrower } from './pages/Borrower';
import { Lender } from './pages/Lender';
import { Pay } from './pages/Pay';
import { Ledger } from './pages/Ledger';
import { PaypalBadge } from './components/Panels';
import { Logo, Sun, Moon, Home, Heart, Store, List, Refresh, Avatar, Shield, Spark, Globe } from './components/Icons';
import { Spinner } from './components/ui';

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); try { localStorage.setItem('fl-theme', dark ? 'dark' : 'light'); } catch { /* storage blocked */ } }, [dark]);
  return [dark, setDark] as const;
}

const TABS = [
  { to: '/borrower', label: 'tab.ravi', long: 'tabLong.borrower', icon: Home },
  { to: '/lender', label: 'tab.maya', long: 'tabLong.lender', icon: Heart },
  { to: '/pay/ravi', label: 'tab.pay', long: 'tabLong.customer', icon: Store },
  { to: '/ledger', label: 'tab.ledger', long: 'tabLong.ledger', icon: List },
];

function LangPicker() {
  const { t, lang, setLang } = useI18n();
  return (
    <label className="relative flex items-center">
      <span className="sr-only">{t('lang.label')}</span>
      <Globe width={18} height={18} className="pointer-events-none absolute left-2.5 text-muted" />
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="min-h-[44px] max-w-[7.5rem] appearance-none rounded-xl border border-line bg-card py-2 pl-8 pr-3 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" data-testid="lang">
        {LANGS.map((l) => <option key={l.code} value={l.code} lang={l.code}>{l.label}</option>)}
      </select>
    </label>
  );
}

function Landing({ onReset }: { onReset: () => void }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const people = [
    { who: 'borrower' as const, to: '/borrower' },
    { who: 'lender' as const, to: '/lender' },
    { who: 'customer' as const, to: '/pay/ravi' },
  ];
  const feats = [[Spark, 'feat1'], [Shield, 'feat2'], [Heart, 'feat3']] as const;
  return (
    <div className="space-y-10">
      <section className="pt-4 sm:pt-10">
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl font-display text-4xl font-semibold leading-[1.12] sm:text-6xl">{t('hero.title')}</motion.h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">{t('hero.text')}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button className="btn-primary text-base" onClick={() => nav('/borrower')}>{t('hero.start')}</button>
          <button className="btn-ghost text-base" onClick={onReset}><Refresh width={18} height={18} />{t('reset')}</button>
        </div>
      </section>
      <section aria-labelledby="who"><h2 id="who" className="label mb-3">{t('personas.heading')}</h2>
        <div className="grid gap-4 md:grid-cols-3">{people.map((p) => (
          <Link key={p.who} to={p.to} className="card group flex flex-col gap-3 p-5 transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-accent">
            <Avatar who={p.who} size={48} /><span className="font-display text-xl font-semibold">{t(`persona.${p.who}.title`)}</span><span className="text-sm text-muted">{t(`persona.${p.who}.text`)}</span><span className="mt-auto text-sm font-semibold text-accent">{t('open')}</span>
          </Link>))}
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {feats.map(([Icon, k]) => (<div key={k} className="rounded-xl2 border border-line p-5"><Icon className="text-accent" /><p className="mt-2 font-semibold">{t(`${k}.title`)}</p><p className="mt-1 text-sm text-muted">{t(`${k}.text`)}</p></div>))}
      </section>
    </div>
  );
}

function Shell() {
  const { t } = useI18n();
  const [s, setS] = useState<State | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dark, setDark] = useTheme();
  const loc = useLocation();
  const load = useCallback(() => api('/api/state').then(setS).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  const reset = async () => { if (!confirm(t('reset.confirm'))) return; setS(await api('/api/reset', {})); };
  const onLanding = loc.pathname === '/';
  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">{t('skip')}</a>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-3">
          <Link to="/" className="flex shrink-0 items-center gap-2 font-display text-xl font-semibold text-accent" aria-label={t('home')}><Logo width={30} height={30} /><span className="hidden text-ink min-[400px]:inline">FairLoop</span></Link>
          <nav aria-label={t('nav.roles')} className="ml-4 hidden items-center gap-1 lg:flex">
            {TABS.map((tab) => <NavLink key={tab.to} to={tab.to} className={({ isActive }) => `btn !min-h-[40px] !px-3 text-sm ${isActive ? 'bg-accentsoft text-accent' : 'text-muted hover:text-ink'}`}>{t(tab.long)}</NavLink>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {s && <div className="hidden xl:block"><PaypalBadge s={s} /></div>}
            <LangPicker />
            <button className="btn-ghost !min-h-[44px] !px-3" onClick={() => setDark(!dark)} aria-label={dark ? t('theme.light') : t('theme.dark')}>{dark ? <Sun /> : <Moon />}</button>
            {!onLanding && <button className="btn-ghost !min-h-[44px] !px-3 text-sm" onClick={reset} aria-label={t('reset')}><Refresh width={18} height={18} /></button>}
          </div>
        </div>
        {s && <div className="mx-auto max-w-6xl px-4 pb-2 xl:hidden"><PaypalBadge s={s} /></div>}
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6">
        {err && <p role="alert" className="card p-4 text-danger">{err} <button className="btn-ghost ml-2" onClick={() => { setErr(null); load(); }}>{t('retry')}</button></p>}
        {!s && !err && <p className="flex items-center gap-2 text-muted"><Spinner />{t('loading')}</p>}
        {s && (
          <Routes>
            <Route path="/" element={<Landing onReset={reset} />} />
            <Route path="/borrower" element={<Page title={t('page.borrower.title')} sub={t('page.borrower.sub')}><Borrower s={s} onState={setS} /></Page>} />
            <Route path="/lender" element={<Page title={t('page.lender.title')} sub={t('page.lender.sub')}><Lender s={s} onState={setS} /></Page>} />
            <Route path="/pay/ravi" element={<Pay s={s} onState={setS} />} />
            <Route path="/ledger" element={<Page title={t('page.ledger.title')} sub={t('page.ledger.sub')}><Ledger s={s} dark={dark} /></Page>} />
            <Route path="*" element={<Landing onReset={reset} />} />
          </Routes>
        )}
      </main>
      <nav aria-label={t('nav.roles')} className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-card/95 backdrop-blur lg:hidden">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={({ isActive }) => `flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-1 text-center text-xs font-semibold leading-tight ${isActive ? 'text-accent' : 'text-muted'}`}><tab.icon />{t(tab.label)}</NavLink>
        ))}
      </nav>
    </div>
  );
}

function Page({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (<div><div className="mb-5"><p className="label">{sub}</p><h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1></div>{children}</div>);
}

export default function App() { return <I18nProvider><BrowserRouter><Shell /></BrowserRouter></I18nProvider>; }
