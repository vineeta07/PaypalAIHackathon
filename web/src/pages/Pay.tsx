import { useState } from 'react';
import { motion } from 'framer-motion';
import { api, fmt, type State } from '../api';
import { useI18n } from '../i18n';
import { Card, useAction, Feedback } from '../components/ui';
import { BakeArt, Avatar, Heart, Check } from '../components/Icons';
import { PayPalButton } from '../components/PayPalButton';

export function Pay({ s, onState }: { s: State; onState: (s: State) => void }) {
  const { t } = useI18n();
  const [pick, setPick] = useState(s.products[0].id);
  const [done, setDone] = useState<null | { productId: string; amount: number; lender: number }>(null);
  const act = useAction();
  const product = s.products.find((p) => p.id === pick)!;
  const name = (id: string) => t(`prod.${id}`, {}, s.products.find((p) => p.id === id)?.name);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-4">
        <Avatar who="borrower" size={56} />
        <div><h1 className="text-[26px] font-semibold leading-tight sm:text-3xl">{t('pay.title')}</h1><p className="text-muted">{t('pay.tagline')}</p></div>
      </div>
      {done ? (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="card p-6 text-center" role="status" aria-live="polite">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accentsoft text-accent"><Check width={28} height={28} /></span>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{t('pay.thanks', { amount: fmt(done.amount) })}</p>
          <p className="mt-1 text-muted">{t('pay.onWay', { product: name(done.productId) })}</p>
          {done.lender > 0 && <p className="mx-auto mt-4 max-w-md rounded-xl bg-paper p-3 text-sm text-muted">{t('pay.helped', { amount: fmt(done.lender) })}</p>}
          <button className="btn-ghost mt-4" onClick={() => setDone(null)}>{t('pay.again')}</button>
        </motion.div>
      ) : (
        <>
          <fieldset data-tour="pay-products">
            <legend className="label mb-3">{t('pay.choose')}</legend>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              {s.products.map((p) => (
                <label key={p.id} className={`card flex cursor-pointer items-center gap-3 p-3 transition-colors hover:border-accent/40 focus-within:ring-2 focus-within:ring-accent ${pick === p.id ? '!border-accent ring-1 ring-accent' : ''}`}>
                  <input type="radio" name="product" value={p.id} checked={pick === p.id} onChange={() => setPick(p.id)} className="sr-only" />
                  <BakeArt kind={p.art} className="h-16 w-20 shrink-0" />
                  <span className="min-w-0"><span className="block font-semibold leading-snug">{name(p.id)}</span><span className="num text-muted">{fmt(p.price_cents)}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <Card>
            <div className="flex items-baseline justify-between gap-3"><span className="font-semibold">{name(product.id)}</span><span className="text-2xl font-semibold tracking-tight num">{fmt(product.price_cents)}</span></div>
            <div className="mt-4">
              <PayPalButton key={pick} mode={s.config.paypal_mode} clientId={s.config.paypal_client_id} label={t('pay.button', { amount: fmt(product.price_cents) })} onError={act.setError}
                createOrder={async () => (await api<{ id: string }>('/api/pay/order', { product_id: pick })).id}
                capture={async (id) => {
                  const r = await api<{ payment: State['payments'][number]; state: State }>('/api/pay/capture', { order_id: id });
                  onState(r.state);
                  setDone({ productId: product.id, amount: r.payment.amount_cents, lender: r.payment.decision.lender_cents });
                }} />
            </div>
            <Feedback error={act.error} ok={act.ok} />
          </Card>
        </>
      )}
      <Card>
        <h2 className="flex items-center gap-2 font-semibold"><Heart className="text-accent" />{t('pay.howTitle')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t('pay.howText')}</p>
      </Card>
    </div>
  );
}
