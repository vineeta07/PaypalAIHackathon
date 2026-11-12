import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, type State } from './api';
import { Borrower } from './pages/Borrower';
import { Lender } from './pages/Lender';
import { Pay } from './pages/Pay';
import { Ledger } from './pages/Ledger';
import { PaypalBadge } from './components/Panels';
import { Logo, Sun, Moon, Home, Heart, Store, List, Refresh, Avatar, Shield, Spark } from './components/Icons';
import { Spinner } from './components/ui';

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); try { localStorage.setItem('fl-theme', dark ? 'dark' : 'light'); } catch { /* storage blocked */ } }, [dark]);
  return [dark, setDark] as const;
}

const TABS = [
  { to: '/borrower', label: 'Ravi', long: 'Borrower: Ravi', icon: Home },
  { to: '/lender', label: 'Maya', long: 'Lender: Maya', icon: Heart },
  { to: '/pay/ravi', label: 'Pay page', long: 'Customer', icon: Store },
  { to: '/ledger', label: 'Ledger', long: 'Ledger', icon: List },
];

function Landing({ s, onReset }: { s: State; onReset: () => void }) {
  const nav = useNavigate();
  const people = [
    { who: 'borrower' as const, title: s.personas.borrower.label, text: 'Asks for $300 for a new oven. Repays a small share of each cake order, only in weeks he earns enough.', to: '/borrower' },
    { who: 'lender' as const, title: s.personas.lender.label, text: 'Lends at 0% interest. Gets repaid automatically, without awkward reminders.', to: '/lender' },
    { who: 'customer' as const, title: 'A customer', text: 'Buys a cake on Ravi’s pay page with PayPal. The split happens on its own.', to: '/pay/ravi' },
  ];
  return (
    <div className="space-y-10">
      <section className="pt-4 sm:pt-10">
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl font-display text-4xl font-semibold leading-[1.08] sm:text-6xl">Loans between people who trust each other, repaid from what you earn.</motion.h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">FairLoop turns a family or community loan into a fair, written agreement. Each time the borrower gets paid through PayPal, an agreed share goes back automatically. Bad week? Nothing is taken.</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button className="btn-primary text-base" onClick={() => nav('/borrower')}>Start demo as Ravi</button>
          <button className="btn-ghost text-base" onClick={onReset}><Refresh width={18} height={18} />Reset demo</button>
        </div>
      </section>
      <section aria-labelledby="who"><h2 id="who" className="label mb-3">Pick who you are (demo personas, no login)</h2>
        <div className="grid gap-4 md:grid-cols-3">{people.map((p) => (
          <Link key={p.who} to={p.to} className="card group flex flex-col gap-3 p-5 transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-accent">
            <Avatar who={p.who} size={48} /><span className="font-display text-xl font-semibold">{p.title}</span><span className="text-sm text-muted">{p.text}</span><span className="mt-auto text-sm font-semibold text-accent">Open →</span>
          </Link>))}
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[[Spark, 'AI drafts, people decide', 'Gemini drafts plain-language terms and checks affordability against real income. It can only propose.'], [Shield, 'Rules enforced in code', 'Integer cents, weekly minimum, weekly cap, idempotent splits, hash-chained ledger.'], [Heart, '0% interest, always', 'Hardship requests can pause or soften terms. Nothing ever gets harsher automatically.']].map(([I, t, d]) => {
          const Icon = I as typeof Spark;
          return (<div key={t as string} className="rounded-xl2 border border-line p-5"><Icon className="text-accent" /><p className="mt-2 font-semibold">{t as string}</p><p className="mt-1 text-sm text-muted">{d as string}</p></div>);
        })}
      </section>
    </div>
  );
}

function Shell() {
  const [s, setS] = useState<State | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dark, setDark] = useTheme();
  const loc = useLocation();
  const load = useCallback(() => api('/api/state').then(setS).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  const reset = async () => { if (!confirm('Reset the demo and reseed Ravi and Maya?')) return; setS(await api('/api/reset', {})); };
  const onLanding = loc.pathname === '/';
  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold text-accent" aria-label="FairLoop home"><Logo width={30} height={30} /><span className="text-ink">FairLoop</span></Link>
          <nav aria-label="Role switcher" className="ml-4 hidden items-center gap-1 md:flex">
            {TABS.map((t) => <NavLink key={t.to} to={t.to} className={({ isActive }) => `btn !min-h-[40px] !px-3 text-sm ${isActive ? 'bg-accentsoft text-accent' : 'text-muted hover:text-ink'}`}>{t.long}</NavLink>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {s && <div className="hidden sm:block"><PaypalBadge s={s} /></div>}
            <button className="btn-ghost !min-h-[44px] !px-3" onClick={() => setDark(!dark)} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>{dark ? <Sun /> : <Moon />}</button>
            {!onLanding && <button className="btn-ghost !min-h-[44px] !px-3 text-sm" onClick={reset} aria-label="Reset demo"><Refresh width={18} height={18} /><span className="hidden lg:inline">Reset demo</span></button>}
          </div>
        </div>
        {s && <div className="mx-auto max-w-6xl px-4 pb-2 sm:hidden"><PaypalBadge s={s} /></div>}
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6">
        {err && <p role="alert" className="card p-4 text-danger">{err} <button className="btn-ghost ml-2" onClick={() => { setErr(null); load(); }}>Retry</button></p>}
        {!s && !err && <p className="flex items-center gap-2 text-muted"><Spinner />Loading FairLoop…</p>}
        {s && (
          <Routes>
            <Route path="/" element={<Landing s={s} onReset={reset} />} />
            <Route path="/borrower" element={<Page title="Ravi's dashboard" sub="Borrower · home baker"><Borrower s={s} onState={setS} /></Page>} />
            <Route path="/lender" element={<Page title="Maya's dashboard" sub="Lender · sister, in Toronto"><Lender s={s} onState={setS} /></Page>} />
            <Route path="/pay/ravi" element={<Pay s={s} onState={setS} />} />
            <Route path="/ledger" element={<Page title="Ledger" sub="Every event, hash-chained"><Ledger s={s} dark={dark} /></Page>} />
            <Route path="*" element={<Landing s={s} onReset={reset} />} />
          </Routes>
        )}
      </main>
      <nav aria-label="Role switcher" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-card/95 backdrop-blur md:hidden">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-accent' : 'text-muted'}`}><t.icon />{t.label}</NavLink>
        ))}
      </nav>
    </div>
  );
}

function Page({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (<div><div className="mb-5"><p className="label">{sub}</p><h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1></div>{children}</div>);
}

export default function App() { return <BrowserRouter><Shell /></BrowserRouter>; }
