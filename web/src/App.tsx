import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api, type State } from './api';
import { I18nProvider, useI18n } from './i18n';
import { Borrower } from './pages/Borrower';
import { Lender } from './pages/Lender';
import { Pay } from './pages/Pay';
import { Ledger } from './pages/Ledger';
import { Home } from './pages/Home';
import { Sidebar, NAV, LangSelect, ThemeToggle } from './components/Sidebar';
import { NextStep } from './components/NextStep';
import { TourProvider, useTour } from './components/Tour';
import { Logo, Menu, Close, Avatar } from './components/Icons';
import { Spinner } from './components/ui';

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); try { localStorage.setItem('fl-theme', dark ? 'dark' : 'light'); } catch { /* storage blocked */ } }, [dark]);
  return [dark, setDark] as const;
}

function Shell() {
  const { t } = useI18n();
  const { start } = useTour();
  const [s, setS] = useState<State | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dark, setDark] = useTheme();
  const [drawer, setDrawer] = useState(false);
  const loc = useLocation();
  const load = useCallback(() => api('/api/state').then(setS).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { window.scrollTo(0, 0); setDrawer(false); }, [loc.pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [drawer]);
  const reset = async () => { if (!confirm(t('reset.confirm'))) return; setS(await api('/api/reset', {})); };
  const sidebar = (onNavigate?: () => void) => <Sidebar s={s} dark={dark} setDark={setDark} onReset={reset} onTour={start} onNavigate={onNavigate} />;

  return (
    <div className="min-h-screen lg:pl-[264px]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">{t('skip')}</a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-line bg-sidebar lg:block">{sidebar()}</aside>

      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-paper/90 px-3 py-2 backdrop-blur lg:hidden">
        <button className="btn-quiet !min-h-[44px] !px-2.5" onClick={() => setDrawer(true)} aria-label={t('nav.menu')} aria-expanded={drawer}><Menu /></button>
        <Link to="/" className="flex items-center gap-2 text-accent" aria-label={t('home')}><Logo width={26} height={26} /><span className="text-base font-semibold tracking-tight text-ink">FairLoop</span></Link>
        <div className="ml-auto flex items-center gap-1" data-tour="settings">
          <div className="w-[118px]"><LangSelect id="lang-top" /></div>
          <ThemeToggle dark={dark} setDark={setDark} compact />
        </div>
      </header>

      <AnimatePresence>
        {drawer && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
            <motion.aside role="dialog" aria-modal="true" aria-label={t('nav.roles')} className="absolute inset-y-0 left-0 w-[284px] max-w-[85vw] border-r border-line bg-sidebar shadow-pop" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'tween', duration: 0.2 }}>
              <button className="btn-quiet absolute right-2 top-3 !min-h-[40px] !px-2" onClick={() => setDrawer(false)} aria-label={t('nav.closeMenu')}><Close width={18} height={18} /></button>
              {sidebar(() => setDrawer(false))}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <main id="main" className="mx-auto max-w-[1180px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
        {err && <p role="alert" className="card p-4 text-danger">{err} <button className="btn-ghost ml-2" onClick={() => { setErr(null); load(); }}>{t('retry')}</button></p>}
        {!s && !err && <p className="flex items-center gap-2 text-muted"><Spinner />{t('loading')}</p>}
        {s && (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/borrower" element={<Page s={s} who="borrower" title={t('page.borrower.title')} sub={t('page.borrower.sub')}><Borrower s={s} onState={setS} /></Page>} />
            <Route path="/lender" element={<Page s={s} who="lender" title={t('page.lender.title')} sub={t('page.lender.sub')}><Lender s={s} onState={setS} /></Page>} />
            <Route path="/pay/ravi" element={<Pay s={s} onState={setS} />} />
            <Route path="/ledger" element={<Page s={s} title={t('page.ledger.title')} sub={t('page.ledger.sub')}><Ledger s={s} dark={dark} /></Page>} />
            <Route path="*" element={<Home />} />
          </Routes>
        )}
      </main>

      <nav aria-label={t('nav.roles')} data-tour="nav" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 text-center text-[11px] font-medium leading-tight ${isActive ? 'text-accent' : 'text-muted'}`}>
            <n.icon width={20} height={20} /><span className="max-w-full truncate">{t(n.short)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Page({ s, who, title, sub, children }: { s: State; who?: 'lender' | 'borrower'; title: string; sub: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0"><p className="eyebrow">{sub}</p><h1 className="mt-1.5 text-[26px] font-semibold leading-tight sm:text-3xl">{title}</h1></div>
        {who && (
          <div className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3 text-sm">
            <Avatar who={who} size={26} /><span className="text-muted">{t('viewingAs')}</span><span className="font-medium">{s.personas[who].name}</span>
          </div>
        )}
      </div>
      <NextStep s={s} />
      {children}
    </div>
  );
}

export default function App() { return <I18nProvider><BrowserRouter><TourProvider><Shell /></TourProvider></BrowserRouter></I18nProvider>; }
