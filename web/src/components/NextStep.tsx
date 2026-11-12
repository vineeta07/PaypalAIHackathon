import { Link, useLocation } from 'react-router-dom';
import type { State } from '../api';
import { useI18n } from '../i18n';
import { nextStep } from '../guide';
import { Arrow, Compass } from './Icons';

const CTA: Record<string, string> = { '/borrower': 'next.cta.borrower', '/lender': 'next.cta.lender', '/pay/ravi': 'next.cta.pay', '/ledger': 'next.cta.ledger' };

/** "What happens next" banner: always tells the viewer who needs to act and links there. */
export function NextStep({ s }: { s: State }) {
  const { t } = useI18n();
  const loc = useLocation();
  const n = nextStep(s);
  const here = loc.pathname === n.to;
  return (
    <section data-tour="next-step" aria-live="polite" className="flex flex-col gap-3 rounded-xl2 border border-accent/25 bg-accentsoft/60 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card text-accent ring-1 ring-accent/20"><Compass width={18} height={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow !text-accent">{t('next.label')}</p>
          <p className="mt-0.5 font-semibold">{t(`next.${n.key}.t`)}</p>
          <p className="text-sm text-muted">{t(`next.${n.key}.b`)}{here ? ` ${t('next.here')}` : ''}</p>
        </div>
      </div>
      {!here && <Link to={n.to} className="btn-primary shrink-0">{t(CTA[n.to])}<Arrow width={16} height={16} /></Link>}
    </section>
  );
}
