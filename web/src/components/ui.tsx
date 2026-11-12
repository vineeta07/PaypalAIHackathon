import { motion, AnimatePresence } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { fmt, fmt0 } from '../api';

export function Card({ children, className = '', title, subtitle, action, id, tour, pad = true }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; id?: string; tour?: string; pad?: boolean }) {
  return (
    <motion.section id={id} data-tour={tour} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`card min-w-0 ${pad ? 'p-5 sm:p-6' : ''} ${className}`} aria-labelledby={title && id ? `${id}-t` : undefined}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={id ? `${id}-t` : undefined} className="text-[15px] font-semibold leading-snug">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </motion.section>
  );
}

type Tone = 'ok' | 'warn' | 'neutral' | 'danger' | 'info';
export function Pill({ tone = 'neutral', children, dot = false }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  const cls = { ok: 'bg-accentsoft text-accent', warn: 'bg-warmsoft text-warm', neutral: 'bg-subtle text-muted ring-1 ring-inset ring-line', danger: 'bg-danger/10 text-danger', info: 'bg-infosoft text-info' }[tone];
  const dotCls = { ok: 'bg-accent', warn: 'bg-warm', neutral: 'bg-muted', danger: 'bg-danger', info: 'bg-info' }[tone];
  return <span className={`pill ${cls}`}>{dot && <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} aria-hidden="true" />}{children}</span>;
}
export function statusTone(s: string): Tone {
  if (['SUCCESS', 'COMPLETED', 'ok', 'approved'].includes(s)) return 'ok';
  if (['PENDING', 'UNCLAIMED', 'warn', 'pending', 'ONHOLD', 'PROCESSING'].includes(s)) return 'warn';
  if (['FAILED', 'DENIED', 'RETURNED', 'BLOCKED', 'denied', 'danger'].includes(s)) return 'danger';
  if (s === 'info') return 'info';
  return 'neutral';
}
export function Money({ cents, className = '', round = false }: { cents: number; className?: string; round?: boolean }) {
  return <span className={`num ${className}`}>{round ? fmt0(cents) : fmt(cents)}</span>;
}
export function Spinner() { return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />; }

/** KPI tile. */
export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'accent' | 'warm' }) {
  return (
    <div className="card min-w-0 p-4">
      <p className="label truncate">{label}</p>
      <p className={`mt-1 truncate text-2xl font-semibold tracking-tight num ${tone === 'accent' ? 'text-accent' : tone === 'warm' ? 'text-warm' : ''}`}>{value}</p>
      {sub && <p className="mt-1 truncate text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function ProgressRing({ value, total, size = 160, label = 'repaid' }: { value: number; total: number; size?: number; label?: string }) {
  const r = (size - 14) / 2; const c = 2 * Math.PI * r; const p = total ? Math.min(1, value / total) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(p * 100)}% ${label}: ${fmt(value)} / ${fmt(total)}`}>
      <svg width={size} height={size} className="-rotate-90"><circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(var(--line))" strokeWidth="8" fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(var(--accent))" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - p) }} transition={{ duration: 0.8, ease: 'easeOut' }} /></svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-3xl font-semibold tracking-tight num">{Math.round(p * 100)}%</span><span className="text-xs text-muted">{label}</span></div>
    </div>
  );
}
export function Bar({ value, max, marker, label }: { value: number; max: number; marker?: number; label: string }) {
  const w = max ? Math.min(100, (value / max) * 100) : 0; const m = marker && max ? Math.min(100, (marker / max) * 100) : null;
  return (
    <div className="relative h-2 w-full rounded-full bg-line/80" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <motion.div className={`h-2 rounded-full ${marker && value < marker ? 'bg-warm' : 'bg-accent'}`} initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.6 }} />
      {m !== null && <div className="absolute -top-1.5 h-5 w-0.5 rounded bg-ink/60" style={{ left: `${m}%` }} aria-hidden="true" />}
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
    <div aria-live="polite">
      <AnimatePresence>
        {error && <motion.p key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" className="mt-3 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</motion.p>}
        {ok && <motion.p key="o" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 rounded-lg border border-accent/20 bg-accentsoft px-3 py-2 text-sm text-accent">{ok}</motion.p>}
      </AnimatePresence>
    </div>
  );
}
export function Empty({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children?: ReactNode }) {
  return (<div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-subtle/60 px-4 py-8 text-center"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted ring-1 ring-line">{icon}</div><p className="mt-1 text-sm font-semibold">{title}</p><p className="max-w-sm text-sm text-muted">{text}</p>{children}</div>);
}
