import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '../i18n';
import { Close, Compass } from './Icons';

/** Each step names a page and an element marked with data-tour="…". Missing targets fall back to a centred card. */
const STEPS: { route: string | null; target?: string }[] = [
  { route: '/', target: 'hero' },
  { route: '/', target: 'nav' },
  { route: '/', target: 'progress' },
  { route: '/borrower', target: 'next-step' },
  { route: '/borrower', target: 'borrower-main' },
  { route: '/lender', target: 'lender-main' },
  { route: '/pay/ravi', target: 'pay-products' },
  { route: '/ledger', target: 'ledger' },
  { route: null, target: 'settings' },
  { route: null },
];
const KEY = 'fl-tour';
const store = { get: () => { try { return localStorage.getItem(KEY); } catch { return 'done'; } }, set: (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* blocked */ } } };

interface Ctx { start: () => void; active: boolean }
const TourCtx = createContext<Ctx>({ start: () => {}, active: false });
export const useTour = () => useContext(TourCtx);

function findTarget(name?: string): HTMLElement | null {
  if (!name) return null;
  const els = [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)];
  return els.find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }) || null;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<number | null>(null);
  const [prompt, setPrompt] = useState(false);
  const start = useCallback(() => { setPrompt(false); setStep(0); }, []);
  useEffect(() => { if (!store.get()) { const t = setTimeout(() => setPrompt(true), 1200); return () => clearTimeout(t); } }, []);
  const end = () => { store.set('done'); setStep(null); };
  return (
    <TourCtx.Provider value={{ start, active: step !== null }}>
      {children}
      {step !== null && <TourOverlay step={step} setStep={setStep} onEnd={end} />}
      <AnimatePresence>{prompt && step === null && <TourPrompt onStart={start} onLater={() => { store.set('dismissed'); setPrompt(false); }} />}</AnimatePresence>
    </TourCtx.Provider>
  );
}

function TourPrompt({ onStart, onLater }: { onStart: () => void; onLater: () => void }) {
  const { t } = useI18n();
  return (
    <motion.div role="dialog" aria-labelledby="tp-t" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
      className="card fixed bottom-24 right-4 z-50 w-[calc(100%-2rem)] max-w-sm p-4 shadow-pop lg:bottom-6 lg:right-6">
      <div className="flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accentsoft text-accent"><Compass width={18} height={18} /></span>
        <div className="min-w-0 flex-1"><p id="tp-t" className="font-semibold">{t('tour.prompt.t')}</p><p className="mt-0.5 text-sm text-muted">{t('tour.prompt.b')}</p>
          <div className="mt-3 flex gap-2"><button className="btn-primary !min-h-[40px]" onClick={onStart}>{t('tour.prompt.start')}</button><button className="btn-quiet !min-h-[40px]" onClick={onLater}>{t('tour.prompt.later')}</button></div>
        </div>
      </div>
    </motion.div>
  );
}

type Rect = { top: number; left: number; width: number; height: number };

function TourOverlay({ step, setStep, onEnd }: { step: number; setStep: (n: number) => void; onEnd: () => void }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const loc = useLocation();
  const cardRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const def = STEPS[step];
  const total = STEPS.length;
  const last = step === total - 1;

  useEffect(() => { if (def.route && loc.pathname !== def.route) nav(def.route); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const measure = useCallback(() => {
    const el = findTarget(def.target);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    const pad = 6;
    const top = Math.max(8, r.top - pad); const bottom = Math.min(window.innerHeight - 8, r.bottom + pad);
    setRect({ top, left: Math.max(8, r.left - pad), width: Math.min(window.innerWidth - 16, r.width + pad * 2), height: Math.max(0, bottom - top) });
  }, [def.target]);

  // Wait for the page to render the target, scroll it into view, then measure.
  useLayoutEffect(() => {
    setReady(false);
    let tries = 0; let raf = 0; let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const el = findTarget(def.target);
      if (el || tries++ > 40 || !def.target) {
        if (el) {
          const r = el.getBoundingClientRect();
          const fits = r.height < window.innerHeight * 0.7;
          if (r.top < 70 || r.bottom > window.innerHeight - 40) el.scrollIntoView({ block: fits ? 'center' : 'start', behavior: 'auto' });
        }
        requestAnimationFrame(() => { measure(); setReady(true); });
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [step, loc.pathname, def.target, measure]);

  useEffect(() => {
    const on = () => measure();
    window.addEventListener('resize', on); window.addEventListener('scroll', on, true);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true); };
  }, [measure]);

  useEffect(() => { if (ready) cardRef.current?.focus(); }, [ready, step]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEnd();
      else if (e.key === 'ArrowRight') last ? onEnd() : setStep(step + 1);
      else if (e.key === 'ArrowLeft' && step > 0) setStep(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, last, onEnd, setStep]);

  // Card placement: bottom sheet on phones; beside, below or above the target on larger screens.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200; const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const W = Math.min(360, vw - 32);
  let pos: React.CSSProperties;
  if (vw < 640) pos = { left: 16, right: 16, bottom: 16 };
  else if (!rect) pos = { left: (vw - W) / 2, top: vh / 2 - 110, width: W };
  else if (rect.left + rect.width + W + 24 < vw && rect.width < 320) pos = { left: rect.left + rect.width + 16, top: Math.min(Math.max(16, rect.top), vh - 240), width: W };
  else if (rect.top + rect.height + 230 < vh) pos = { left: Math.min(Math.max(16, rect.left), vw - W - 16), top: rect.top + rect.height + 12, width: W };
  else if (rect.top > 240) pos = { left: Math.min(Math.max(16, rect.left), vw - W - 16), top: rect.top - 12, transform: 'translateY(-100%)', width: W };
  else pos = { left: (vw - W) / 2, bottom: 24, width: W };

  return createPortal(
    <div className="fixed inset-0 z-[70]" aria-live="polite">
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      {rect && ready
        ? <div className="pointer-events-none absolute rounded-xl transition-all duration-200" style={{ ...rect, boxShadow: '0 0 0 9999px rgba(10, 12, 14, 0.55)', outline: '2px solid rgb(var(--accent))', outlineOffset: 0 }} />
        : <div className="pointer-events-none absolute inset-0 bg-[rgba(10,12,14,0.55)]" />}
      <AnimatePresence mode="wait">
        {ready && (
          <motion.div key={step} ref={cardRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tour-t" aria-describedby="tour-b" data-testid="tour"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="card absolute p-5 shadow-pop outline-none" style={pos}>
            <div className="flex items-start justify-between gap-3">
              <p className="eyebrow">{t('tour.step', { n: step + 1, total })}</p>
              <button className="-m-2 rounded-md p-2 text-muted hover:text-ink" onClick={onEnd} aria-label={t('tour.skip')}><Close width={16} height={16} /></button>
            </div>
            <h2 id="tour-t" className="mt-1 text-lg font-semibold">{t(`tour.${step + 1}.t`)}</h2>
            <p id="tour-b" className="mt-1.5 text-sm leading-relaxed text-muted">{t(`tour.${step + 1}.b`)}</p>
            <div className="mt-4 flex items-center gap-1" aria-hidden="true">{STEPS.map((_, i) => <span key={i} className={`h-1 rounded-full transition-all ${i === step ? 'w-5 bg-accent' : 'w-1.5 bg-line'}`} />)}</div>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button className="btn-quiet !min-h-[40px] !px-2 text-[13px]" onClick={onEnd}>{t('tour.skip')}</button>
              <div className="flex gap-2">
                {step > 0 && <button className="btn-ghost !min-h-[40px]" onClick={() => setStep(step - 1)}>{t('tour.back')}</button>}
                <button className="btn-primary !min-h-[40px]" onClick={() => (last ? onEnd() : setStep(step + 1))}>{last ? t('tour.done') : t('tour.next')}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
