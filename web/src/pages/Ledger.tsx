import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { api, fmt, type LedgerEvent, type State } from '../api';
import { useI18n, LANGS } from '../i18n';
import { Card, Pill, statusTone, useAction, Feedback, Spinner, Empty } from '../components/ui';
import { Shield, List } from '../components/Icons';

const GROUP: Record<string, string> = { fallback_plan: 'fallback', fallback_ready: 'fallback', fallback_activated: 'fallback', fallback_suspended: 'fallback', fallback_cancelled: 'fallback', fallback_charge: 'fallback', review_prompt: 'review', review_vote: 'review', review_applied: 'review' };

function useWide() {
  const q = '(min-width: 768px)';
  const [wide, setWide] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q); const f = () => setWide(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return wide;
}

export function Ledger({ s, dark }: { s: State; dark: boolean }) {
  const { t, lang } = useI18n();
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [filter, setFilter] = useState('');
  const [verify, setVerify] = useState<null | { ok: boolean; count: number; broken_at?: number }>(null);
  const act = useAction();
  const wide = useWide();
  useEffect(() => { api<{ events: LedgerEvent[] }>('/api/ledger').then((r) => setEvents(r.events.slice().reverse())).catch((e) => act.setError(e.message)); }, [s.ledger_count]); // eslint-disable-line react-hooks/exhaustive-deps
  const label = (type: string) => t(`ev.${GROUP[type] || type}`, {}, type);
  const shown = useMemo(() => events.filter((e) => !filter || `${e.type} ${label(e.type)} ${e.summary} ${e.actor} ${e.ref}`.toLowerCase().includes(filter.toLowerCase())), [events, filter, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const locale = LANGS.find((l) => l.code === lang)!.locale;
  const cols = useMemo<ColDef<LedgerEvent>[]>(() => [
    { field: 'seq', headerName: '#', width: 70, sort: 'desc' },
    { field: 'at', headerName: t('col.time'), width: 120, valueFormatter: (p) => new Date(p.value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
    { field: 'type', headerName: t('col.event'), width: 150, cellRenderer: (p: { value: string; data: LedgerEvent }) => <Pill tone={p.data.type === 'skip' ? 'warn' : statusTone(p.data.status)}>{label(p.value)}</Pill> },
    { field: 'actor', headerName: t('col.by'), width: 100 },
    { field: 'summary', headerName: t('col.what'), flex: 1, minWidth: 320, wrapText: true, autoHeight: true, cellStyle: { lineHeight: '1.4', paddingTop: '8px', paddingBottom: '8px' } as Record<string, string> },
    { field: 'amount_cents', headerName: t('col.amount'), width: 120, type: 'rightAligned', valueFormatter: (p) => (p.value ? fmt(p.value) : '—') },
    { field: 'hash', headerName: t('col.hash'), width: 130, valueFormatter: (p) => `${String(p.value).slice(0, 10)}…`, cellStyle: { fontFamily: 'ui-monospace, monospace', fontSize: '12px' } as Record<string, string> },
  ], [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Card id="ledger" title={<span className="flex items-center gap-2"><List className="text-accent" />{t('page.ledger.title')}</span>} action={
      <button className="btn-ghost !min-h-[44px] text-sm" disabled={!!act.busy} onClick={() => act.run('v', async () => { const r = await api<{ ok: boolean; count: number }>('/api/ledger/verify'); setVerify(r); if (!r.ok) throw new Error(t('led.failed')); }, t('led.verified'))}>{act.busy ? <Spinner /> : <Shield width={18} height={18} />}{t('led.verify')}</button>}>
      <p className="text-sm text-muted">{t('led.intro')} {lang !== 'en' && t('led.note')}</p>
      {verify && <p className={`mt-2 text-sm font-semibold ${verify.ok ? 'text-accent' : 'text-danger'}`} aria-live="polite">{verify.ok ? t('led.ok', { n: verify.count }) : t('led.broken', { n: verify.broken_at ?? 0 })}</p>}
      <label className="mt-4 block"><span className="label">{t('led.filter')}</span><input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('led.placeholder')} className="mt-1 min-h-[44px] w-full rounded-xl border border-line bg-paper px-3" /></label>
      <div className="mt-4">
        {!events.length ? <Empty icon={<List />} title={t('led.emptyTitle')} text={t('led.emptyText')} /> : wide ? (
          <div className={`${dark ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'} w-full`} style={{ height: 520 }}>
            <AgGridReact<LedgerEvent> key={lang} rowData={shown} columnDefs={cols} defaultColDef={{ sortable: true, resizable: true, filter: true }} pagination paginationPageSize={20} paginationPageSizeSelector={[20, 50, 100]} />
          </div>
        ) : (
          <ul className="space-y-2">{shown.slice(0, 60).map((e) => (
            <li key={e.seq} className="rounded-xl border border-line p-3"><div className="flex items-center justify-between gap-2"><Pill tone={e.type === 'skip' ? 'warn' : statusTone(e.status)}>{label(e.type)}</Pill><span className="text-xs text-muted num">#{e.seq}{e.amount_cents ? ` · ${fmt(e.amount_cents)}` : ''}</span></div><p className="mt-2 text-sm">{e.summary}</p><p className="mt-1 text-xs text-muted num">{e.hash.slice(0, 16)}…</p></li>
          ))}</ul>
        )}
      </div>
      <Feedback error={act.error} ok={act.ok} />
    </Card>
  );
}
