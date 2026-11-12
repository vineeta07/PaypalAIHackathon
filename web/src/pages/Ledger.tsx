import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { api, fmt, type LedgerEvent, type State } from '../api';
import { Card, Pill, statusTone, useAction, Feedback, Spinner, Empty } from '../components/ui';
import { Shield, List } from '../components/Icons';


const TYPE_LABEL: Record<string, string> = { agreement_drafted: 'Agreement', approval: 'Approval', agreement_active: 'Active', agreement_edited: 'Edit', funding: 'Funding', disbursement: 'Disbursement', payment: 'Payment', split: 'Split', skip: 'Skipped', hardship_request: 'Hardship', hardship_approved: 'Hardship ✓', hardship_denied: 'Hardship ✗', payoff: 'Paid off', fallback_plan: 'Fallback', fallback_ready: 'Fallback', fallback_activated: 'Fallback on', fallback_suspended: 'Fallback off', fallback_cancelled: 'Fallback end', fallback_charge: 'Fallback', review_prompt: 'Review', review_vote: 'Review', review_applied: 'Review', week_closed: 'Week', reset: 'Reset', end_of_term: 'Term end', webhook: 'Webhook' };

function useWide() {
  const q = '(min-width: 768px)';
  const [wide, setWide] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q); const f = () => setWide(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return wide;
}

export function Ledger({ s, dark }: { s: State; dark: boolean }) {
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [filter, setFilter] = useState('');
  const [verify, setVerify] = useState<null | { ok: boolean; count: number; broken_at?: number }>(null);
  const act = useAction();
  const wide = useWide();
  useEffect(() => { api<{ events: LedgerEvent[] }>('/api/ledger').then((r) => setEvents(r.events.slice().reverse())).catch((e) => act.setError(e.message)); }, [s.ledger_count]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => events.filter((e) => !filter || `${e.type} ${e.summary} ${e.actor} ${e.ref}`.toLowerCase().includes(filter.toLowerCase())), [events, filter]);
  const cols = useMemo<ColDef<LedgerEvent>[]>(() => [
    { field: 'seq', headerName: '#', width: 70, sort: 'desc' },
    { field: 'at', headerName: 'Time', width: 120, valueFormatter: (p) => new Date(p.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
    { field: 'type', headerName: 'Event', width: 140, cellRenderer: (p: { value: string; data: LedgerEvent }) => <Pill tone={p.data.type === 'skip' ? 'warn' : statusTone(p.data.status)}>{TYPE_LABEL[p.value] || p.value}</Pill> },
    { field: 'actor', headerName: 'By', width: 100 },
    { field: 'summary', headerName: 'What happened', flex: 1, minWidth: 320, wrapText: true, autoHeight: true, cellStyle: { lineHeight: '1.4', paddingTop: '8px', paddingBottom: '8px' } as Record<string, string> },
    { field: 'amount_cents', headerName: 'Amount', width: 110, type: 'rightAligned', valueFormatter: (p) => (p.value ? fmt(p.value) : '—') },
    { field: 'hash', headerName: 'Hash', width: 130, valueFormatter: (p) => `${String(p.value).slice(0, 10)}…`, cellStyle: { fontFamily: 'ui-monospace, monospace', fontSize: '12px' } as Record<string, string> },
  ], []);
  return (
    <Card id="ledger" title={<span className="flex items-center gap-2"><List className="text-accent" />Ledger</span>} action={
      <button className="btn-ghost !min-h-[44px] text-sm" disabled={!!act.busy} onClick={() => act.run('v', async () => { const r = await api<{ ok: boolean; count: number }>('/api/ledger/verify'); setVerify(r); if (!r.ok) throw new Error('Chain check failed: an event was changed.'); }, 'Hash chain verified.')}>{act.busy ? <Spinner /> : <Shield width={18} height={18} />}Verify chain</button>}>
      <p className="text-sm text-muted">Every event is linked to the one before it with SHA-256. Change any row and verification fails.</p>
      {verify && <p className={`mt-2 text-sm font-semibold ${verify.ok ? 'text-accent' : 'text-danger'}`} aria-live="polite">{verify.ok ? `✓ ${verify.count} events, chain intact` : `✗ Broken at event ${verify.broken_at}`}</p>}
      <label className="mt-4 block"><span className="label">Filter</span><input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="payment, skipped, hardship…" className="mt-1 min-h-[44px] w-full rounded-xl border border-line bg-paper px-3" /></label>
      <div className="mt-4">
        {!events.length ? <Empty icon={<List />} title="No events yet" text="Start the demo: the agreement, approvals, funding and every payment will be recorded here." /> : wide ? (
          <div className={`${dark ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'} w-full`} style={{ height: 520 }}>
            <AgGridReact<LedgerEvent> rowData={shown} columnDefs={cols} defaultColDef={{ sortable: true, resizable: true, filter: true }} pagination paginationPageSize={20} paginationPageSizeSelector={[20, 50, 100]} />
          </div>
        ) : (
          <ul className="space-y-2">{shown.slice(0, 60).map((e) => (
            <li key={e.seq} className="rounded-xl border border-line p-3"><div className="flex items-center justify-between gap-2"><Pill tone={e.type === 'skip' ? 'warn' : statusTone(e.status)}>{TYPE_LABEL[e.type] || e.type}</Pill><span className="text-xs text-muted num">#{e.seq}{e.amount_cents ? ` · ${fmt(e.amount_cents)}` : ''}</span></div><p className="mt-2 text-sm">{e.summary}</p><p className="mt-1 text-xs text-muted num">{e.hash.slice(0, 16)}…</p></li>
          ))}</ul>
        )}
      </div>
      <Feedback error={act.error} ok={act.ok} />
    </Card>
  );
}
