import { useState } from 'react';
import { motion } from 'framer-motion';
import { api, fmt, type State } from '../api';
import { Card, useAction, Feedback } from '../components/ui';
import { BakeArt, Avatar, Heart, Check } from '../components/Icons';
import { PayPalButton } from '../components/PayPalButton';

export function Pay({ s, onState }: { s: State; onState: (s: State) => void }) {
  const [pick, setPick] = useState(s.products[0].id);
  const [done, setDone] = useState<null | { product: string; amount: number; reason: string; lender: number }>(null);
  const act = useAction();
  const product = s.products.find((p) => p.id === pick)!;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-4">
        <Avatar who="borrower" size={56} />
        <div><h1 className="font-display text-3xl font-semibold">Ravi's Kitchen</h1><p className="text-muted">Home-baked cakes and bread, made to order.</p></div>
      </div>
      {done ? (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="card p-6 text-center" role="status" aria-live="polite">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accentsoft text-accent"><Check width={28} height={28} /></span>
          <p className="mt-3 font-display text-2xl font-semibold">Thank you! Paid {fmt(done.amount)}</p>
          <p className="mt-1 text-muted">Your {done.product} is on its way to the oven.</p>
          <p className="mx-auto mt-4 max-w-md rounded-xl bg-paper p-3 text-sm text-muted">{done.lender > 0 ? `${fmt(done.lender)} of this helped Ravi repay his oven loan. ` : ''}{done.reason}</p>
          <button className="btn-ghost mt-4" onClick={() => setDone(null)}>Order something else</button>
        </motion.div>
      ) : (
        <>
          <fieldset>
            <legend className="label mb-3">Choose your treat</legend>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              {s.products.map((p) => (
                <label key={p.id} className={`card flex cursor-pointer items-center gap-3 p-3 transition-colors focus-within:ring-2 focus-within:ring-accent ${pick === p.id ? 'border-accent ring-1 ring-accent' : ''}`}>
                  <input type="radio" name="product" value={p.id} checked={pick === p.id} onChange={() => setPick(p.id)} className="sr-only" />
                  <BakeArt kind={p.art} className="h-16 w-20 shrink-0" />
                  <span className="min-w-0"><span className="block font-semibold leading-snug">{p.name}</span><span className="num text-muted">{fmt(p.price_cents)}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <Card>
            <div className="flex items-baseline justify-between"><span className="font-semibold">{product.name}</span><span className="font-display text-2xl font-semibold num">{fmt(product.price_cents)}</span></div>
            <div className="mt-4">
              <PayPalButton key={pick} mode={s.config.paypal_mode} clientId={s.config.paypal_client_id} label={`Pay ${fmt(product.price_cents)} with PayPal`} onError={act.setError}
                createOrder={async () => (await api<{ id: string }>('/api/pay/order', { product_id: pick })).id}
                capture={async (id) => {
                  const r = await api<{ payment: State['payments'][number]; state: State }>('/api/pay/capture', { order_id: id });
                  onState(r.state);
                  setDone({ product: product.name, amount: r.payment.amount_cents, reason: r.payment.decision.reason, lender: r.payment.decision.lender_cents });
                }} />
            </div>
            <Feedback error={act.error} ok={act.ok} />
          </Card>
        </>
      )}
      <Card>
        <h2 className="flex items-center gap-2 font-semibold"><Heart className="text-accent" />How your payment helps</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">Ravi borrowed from his sister Maya, interest-free, to buy a new oven. When you pay here, a small agreed share goes back to Maya automatically and the rest goes straight to Ravi. You pay the normal price; nothing extra is added.</p>
      </Card>
    </div>
  );
}
