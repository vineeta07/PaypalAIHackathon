import { motion, AnimatePresence } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { fmt, fmt0 } from '../api';

export function Card({ children, className = '', title, action, id }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <motion.section id={id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className={`card p-5 sm:p-6 min-w-0 ${className}`} aria-labelledby={title && id ? `${id}-t` : undefined}>
      {(title || action) && (<div className="mb-4 flex items-start justify-between gap-3"><h2 id={id ? `${id}-t` : undefined} className="font-display text-xl font-semibold leading-tight">{title}</h2>{action}</div>)}
      {children}
    </motion.section>
  );
}
export function Pill({ tone = 'neutral', children }: { tone?: 'ok' | 'warn' | 'neutral' | 'danger' | 'info'; children: ReactNode }) {
  const cls = { ok: 'bg-accentsoft text-accent', warn: 'bg-warmsoft text-warm', neutral: 'bg-paper text-muted border border-line', danger: 'bg-danger/10 text-danger', info: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200' }[tone];
  return <span className={`pill ${cls}`}>{children}</span>;
}
export function statusTone(s: string): 'ok' | 'warn' | 'neutral' | 'danger' | 'info' {
  if (['SUCCESS', 'COMPLETED', 'ok', 'approved', 'ACTIVE_OK'].includes(s)) return 'ok';
  if (['PENDING', 'UNCLAIMED', 'warn', 'pending', 'ONHOLD'].includes(s)) return 'warn';
  if (['FAILED', 'DENIED', 'RETURNED', 'BLOCKED', 'denied', 'danger'].includes(s)) return 'danger';
  if (s === 'info') return 'info';
  return 'neutral';
}
export function Money({ cents, className = '', round = false }: { cents: number; className?: string; round?: boolean }) {
  return <span className={`num ${className}`}>{round ? fmt0(cents) : fmt(cents)}</span>;
}
export function Spinner() { return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />; }

export function ProgressRing({ value, total, size = 168 }: { value: number; total: number; size?: number }) {
  const r = (size - 18) / 2; const c = 2 * Math.PI * r; const p = total ? Math.min(1, value / total) : 0;
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(p * 100)}% repaid: ${fmt(value)} of ${fmt(total)}`}>
      <svg width={size} height={size} className="-rotate-90"><circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(var(--line))" strokeWidth="12" fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(var(--accent))" strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - p) }} transition={{ duration: 0.8, ease: 'easeOut' }} /></svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><span className="font-display text-3xl font-semibold num">{Math.round(p * 100)}%</span><span className="text-xs text-muted">repaid</span></div>
    </div>
  );
}
export function Bar({ value, max, marker, label }: { value: number; max: number; marker?: number; label: string }) {
  const w = max ? Math.min(100, (value / max) * 100) : 0; const m = marker && max ? Math.min(100, (marker / max) * 100) : null;
  return (
    <div className="relative h-3 w-full rounded-full bg-line/70" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <motion.div className={`h-3 rounded-full ${marker && value < marker ? 'bg-warm' : 'bg-accent'}`} initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.6 }} />
      {m !== null && <div className="absolute -top-1 h-5 w-0.5 rounded bg-ink/70" style={{ left: `${m}%` }} aria-hidden="true" />}
    </div>
  );
}

/** Wraps an async action with loading / success / error states. */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  async function run<T>(key: string, fn: () => Promise<T>, success?: string): Promise<T | undefined> {
    setBusy(key); setError(null); setOk(null);
    try { const r = await fn(); if (success) { setOk(success); setTimeout(() => setOk(null), 3500); } return r; }
    catch (e) { setError((e as Error).message); return undefined; }
    finally { setBusy(null); }
  }
  return { busy, error, ok, run, setError };
}
export function Feedback({ error, ok }: { error: string | null; ok: string | null }) {
  return (
    <div aria-live="polite" className="min-h-0">
      <AnimatePresence>
        {error && <motion.p key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</motion.p>}
        {ok && <motion.p key="o" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 rounded-xl bg-accentsoft px-3 py-2 text-sm text-accent">{ok}</motion.p>}
      </AnimatePresence>
    </div>
  );
}
export function Empty({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children?: ReactNode }) {
  return (<div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-8 text-center"><div className="text-muted">{icon}</div><p className="font-semibold">{title}</p><p className="max-w-sm text-sm text-muted">{text}</p>{children}</div>);
}
