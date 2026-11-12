// Hand-off between the assistant and page forms. The assistant may only *prefill*; people submit.
import { useEffect, useRef } from 'react';

export type PrefillKind = 'request' | 'hardship';
const pending: Partial<Record<PrefillKind, string>> = {};

export function emitPrefill(kind: PrefillKind, text: string) {
  pending[kind] = text;
  window.dispatchEvent(new CustomEvent('fl:prefill', { detail: { kind } }));
}

/** Receives prefills even if the page mounts after the assistant navigated to it. */
export function usePrefill(kind: PrefillKind, onPrefill: (text: string) => void) {
  const cb = useRef(onPrefill);
  cb.current = onPrefill;
  useEffect(() => {
    const take = () => { const v = pending[kind]; if (v !== undefined) { delete pending[kind]; cb.current(v); } };
    take();
    const on = (e: Event) => { if ((e as CustomEvent).detail?.kind === kind) take(); };
    window.addEventListener('fl:prefill', on);
    return () => window.removeEventListener('fl:prefill', on);
  }, [kind]);
}
