import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { Spinner } from './ui';

declare global { interface Window { [k: string]: any } }
const loaded: Record<string, Promise<void>> = {};
function loadSdk(clientId: string, ns: string, extra: string) {
  const key = ns;
  if (!loaded[key]) loaded[key] = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&components=buttons${extra}`;
    s.dataset.namespace = ns; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error('Could not load PayPal. Check your connection.'));
    document.head.appendChild(s);
  });
  return loaded[key];
}

interface Props { mode: 'simulated' | 'sandbox'; clientId: string | null; createOrder: () => Promise<string>; capture: (orderId: string) => Promise<void>; label: string; disabled?: boolean; onError: (m: string) => void }

/** PayPal Orders v2 buttons (sandbox) or a clearly labelled simulated stand-in. */
export function PayPalButton({ mode, clientId, createOrder, capture, label, disabled, onError }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [sdkErr, setSdkErr] = useState<string | null>(null);
  const cb = useRef({ createOrder, capture, onError }); cb.current = { createOrder, capture, onError };
  useEffect(() => {
    if (mode !== 'sandbox' || !clientId || disabled) return;
    let btn: any; let cancelled = false;
    loadSdk(clientId, 'paypal_orders', '&intent=capture').then(() => {
      if (cancelled || !ref.current) return;
      btn = window.paypal_orders.Buttons({
        style: { layout: 'vertical', shape: 'rect', label: 'pay', height: 45 },
        createOrder: () => cb.current.createOrder(),
        onApprove: async (data: { orderID: string }, actions: any) => {
          try { await cb.current.capture(data.orderID); } catch (e) {
            const pe = (e as ApiError).paypal;
            if (pe?.issue === 'INSTRUMENT_DECLINED') return actions.restart();
            cb.current.onError((e as Error).message);
          }
        },
        onError: () => cb.current.onError('PayPal could not complete the payment. Please try again.'),
      });
      ref.current.innerHTML = '';
      btn.render(ref.current);
    }).catch((e) => setSdkErr(e.message));
    return () => { cancelled = true; try { btn?.close?.(); } catch { /* noop */ } };
  }, [mode, clientId, disabled]);

  if (mode === 'sandbox' && clientId) return (<div>{sdkErr && <p className="text-sm text-danger">{sdkErr}</p>}<div ref={ref} className={disabled ? 'pointer-events-none opacity-50' : ''} /></div>);
  return (
    <button className="btn w-full bg-[#ffc439] text-[#111] hover:brightness-95" disabled={disabled || busy} onClick={async () => {
      setBusy(true);
      try { const id = await createOrder(); await capture(id); } catch (e) { onError((e as Error).message); } finally { setBusy(false); }
    }}>
      {busy ? <Spinner /> : null}{label} <span className="rounded bg-black/10 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">simulated</span>
    </button>
  );
}

/** PayPal Subscriptions approval (fallback safeguard). */
export function SubscribeButton({ mode, clientId, onDone, onError }: { mode: 'simulated' | 'sandbox'; clientId: string | null; onDone: () => void; onError: (m: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== 'sandbox' || !clientId || !planId) return;
    loadSdk(clientId, 'paypal_subs', '&vault=true&intent=subscription').then(() => {
      if (!ref.current) return;
      ref.current.innerHTML = '';
      window.paypal_subs.Buttons({
        style: { shape: 'rect', label: 'subscribe', height: 45 },
        createSubscription: (_d: unknown, actions: any) => actions.subscription.create({ plan_id: planId }),
        onApprove: async (data: { subscriptionID: string }) => { try { await api('/api/fallback/approved', { subscription_id: data.subscriptionID }); onDone(); } catch (e) { onError((e as Error).message); } },
        onError: () => onError('PayPal could not set up the fallback. Please try again.'),
      }).render(ref.current);
    }).catch((e) => onError(e.message));
  }, [planId, mode, clientId, onDone, onError]);
  async function start() {
    setBusy(true);
    try {
      const r = await api<{ plan_id: string; sim_subscription_id: string | null }>('/api/fallback/plan', {});
      if (mode === 'simulated' && r.sim_subscription_id) { await api('/api/fallback/approved', { subscription_id: r.sim_subscription_id }); onDone(); }
      else setPlanId(r.plan_id);
    } catch (e) { onError((e as Error).message); } finally { setBusy(false); }
  }
  if (planId && mode === 'sandbox') return <div ref={ref} />;
  return (<button className="btn-primary w-full" onClick={start} disabled={busy}>{busy && <Spinner />}Approve fallback with PayPal{mode === 'simulated' && <span className="rounded bg-black/10 px-1.5 py-0.5 text-[11px] font-bold uppercase">simulated</span>}</button>);
}
