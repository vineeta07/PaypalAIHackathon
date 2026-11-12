import { NavLink, useNavigate } from 'react-router-dom';
import type { State } from '../api';
import { useI18n, LANGS, type Lang } from '../i18n';
import { progress } from '../guide';
import { Pill } from './ui';
import { Logo, Home, Heart, Store, List, Sun, Moon, Refresh, Compass, Check, Globe, Avatar, Book, Download } from './Icons';
import { useInstall } from '../pwa';

export const NAV = [
  { to: '/', key: 'nav.overview', short: 'nav.overview', icon: Book, end: true },
  { to: '/borrower', key: 'nav.borrower', short: 'tab.ravi', icon: Home, who: 'borrower' as const },
  { to: '/lender', key: 'nav.lender', short: 'tab.maya', icon: Heart, who: 'lender' as const },
  { to: '/pay/ravi', key: 'nav.pay', short: 'tab.pay', icon: Store, who: 'customer' as const },
  { to: '/ledger', key: 'nav.ledger', short: 'tab.ledger', icon: List },
];

export function LangSelect({ id }: { id: string }) {
  const { t, lang, setLang } = useI18n();
  return (
    <label htmlFor={id} className="relative flex w-full items-center">
      <span className="sr-only">{t('lang.label')}</span>
      <Globe width={16} height={16} className="pointer-events-none absolute left-3 text-muted" />
      <select id={id} data-testid="lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="input appearance-none !min-h-[40px] pl-9 pr-3 text-sm">
        {LANGS.map((l) => <option key={l.code} value={l.code} lang={l.code}>{l.label}</option>)}
      </select>
    </label>
  );
}

export function ThemeToggle({ dark, setDark, compact = false }: { dark: boolean; setDark: (d: boolean) => void; compact?: boolean }) {
  const { t } = useI18n();
  if (compact) return <button className="btn-quiet !min-h-[44px] !px-3" onClick={() => setDark(!dark)} aria-label={dark ? t('theme.light') : t('theme.dark')}>{dark ? <Sun width={18} height={18} /> : <Moon width={18} height={18} />}</button>;
  return (
    <div role="group" aria-label={t('theme.label')} className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-card p-1">
      {[false, true].map((d) => (
        <button key={String(d)} aria-pressed={dark === d} onClick={() => setDark(d)} className={`flex min-h-[32px] items-center justify-center gap-1.5 rounded-md text-xs font-medium ${dark === d ? 'bg-subtle text-ink ring-1 ring-line' : 'text-muted hover:text-ink'}`}>
          {d ? <Moon width={14} height={14} /> : <Sun width={14} height={14} />}{d ? t('theme.darkName') : t('theme.lightName')}
        </button>
      ))}
    </div>
  );
}

export function Sidebar({ s, dark, setDark, onReset, onTour, onNavigate }: { s: State | null; dark: boolean; setDark: (d: boolean) => void; onReset: () => void; onTour: () => void; onNavigate?: () => void }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const install = useInstall();
  const steps = s ? progress(s) : [];
  const required = steps.filter((x) => !x.optional);
  const done = required.filter((x) => x.done).length;
  const current = steps.find((x) => !x.done && !x.optional);
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-4">
      <NavLink to="/" onClick={onNavigate} className="flex items-center gap-2.5 px-2 text-accent" aria-label={t('home')}>
        <Logo width={30} height={30} /><span className="text-[18px] font-semibold tracking-[-0.03em] text-ink">Fair<span className="text-accent">Loop</span></span>
      </NavLink>

      <nav aria-label={t('nav.roles')} data-tour="nav">
        <p className="eyebrow mb-2 px-2">{t('nav.section.demo')}</p>
        <ul className="space-y-0.5">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} end={n.end} onClick={onNavigate} className={({ isActive }) => `flex min-h-[40px] items-center gap-3 rounded-lg px-2 text-sm font-medium transition-colors ${isActive ? 'bg-card text-ink shadow-soft ring-1 ring-line' : 'text-muted hover:bg-card/60 hover:text-ink'}`}>
                {n.who ? <Avatar who={n.who} size={22} /> : <n.icon width={18} height={18} className="mx-0.5" />}
                <span className="truncate">{t(n.key)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {s && (
        <section data-tour="progress" aria-labelledby="prog-h">
          <div className="mb-2 flex items-baseline justify-between px-2"><p id="prog-h" className="eyebrow">{t('nav.section.progress')}</p><span className="text-xs text-muted num">{t('prog.count', { done, total: required.length })}</span></div>
          <div className="mx-2 mb-3 h-1 rounded-full bg-line"><div className="h-1 rounded-full bg-accent transition-all" style={{ width: `${(done / required.length) * 100}%` }} /></div>
          <ol className="space-y-0.5">
            {steps.map((st) => {
              const isCurrent = current?.key === st.key;
              return (
                <li key={st.key}>
                  <button onClick={() => { nav(st.to); onNavigate?.(); }} className={`flex min-h-[36px] w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] hover:bg-card/60 ${isCurrent ? 'font-semibold text-ink' : st.done ? 'text-muted' : 'text-muted/80'}`} aria-current={isCurrent ? 'step' : undefined}>
                    <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${st.done ? 'border-accent bg-accent text-onaccent' : isCurrent ? 'border-accent text-accent' : 'border-line'}`}>
                      {st.done ? <Check width={11} height={11} strokeWidth={3} /> : isCurrent ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                    </span>
                    <span className={`truncate ${st.done ? 'line-through decoration-muted/40' : ''}`}>{t(`prog.${st.key}`)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="mt-auto space-y-3" data-tour="settings">
        <button onClick={() => { onTour(); onNavigate?.(); }} className="btn-ghost w-full !justify-start"><Compass width={16} height={16} />{t('nav.tour')}</button>
        {install.canInstall && <button onClick={() => install.prompt()} className="btn-ghost w-full !justify-start" data-testid="install"><Download width={16} height={16} />{t('pwa.install')}</button>}
        {!install.canInstall && install.ios && !install.installed && <p className="rounded-lg border border-line bg-card px-3 py-2 text-xs text-muted"><Download width={13} height={13} className="mr-1 inline" />{t('pwa.ios')}</p>}
        <p className="eyebrow px-2">{t('nav.section.settings')}</p>
        <LangSelect id="lang-side" />
        <ThemeToggle dark={dark} setDark={setDark} />
        {s && (
          <div className="rounded-lg border border-line bg-card p-3">
            <p className="label mb-2">{t('mode.title')}</p>
            <div className="flex flex-wrap gap-1.5">
              <Pill tone={s.config.paypal_mode === 'sandbox' ? 'ok' : 'warn'} dot>{s.config.paypal_mode === 'sandbox' ? t('badge.sandbox') : t('badge.sim')}</Pill>
              <Pill tone={s.config.ai === 'gemini' ? 'info' : 'neutral'} dot>{t('badge.ai', { mode: t(`ai.${s.config.ai}`) })}</Pill>
            </div>
            <p className="mt-2 text-xs text-muted">{t('demo.badge')}</p>
          </div>
        )}
        <button onClick={onReset} className="btn-quiet w-full !justify-start text-[13px]"><Refresh width={16} height={16} />{t('reset')}</button>
      </div>
    </div>
  );
}
