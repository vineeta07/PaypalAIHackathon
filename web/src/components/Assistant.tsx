import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api, fmt0, type State } from '../api';
import { useI18n, LANGS, type Lang } from '../i18n';
import { emitPrefill } from '../agentBus';
import { useInstall } from '../pwa';
import { useTour } from './Tour';
import { Spinner } from './ui';
import { Close, Mic, Send, Volume, VolumeOff, Trash, Spark } from './Icons';

type Action =
  | { type: 'navigate'; page: string; to: string }
  | { type: 'set_language'; lang: Lang }
  | { type: 'start_tour' }
  | { type: 'install' }
  | { type: 'prefill_request'; text: string }
  | { type: 'prefill_hardship'; text: string }
  | { type: 'confirm'; op: 'simulate_week'; mode: 'low' | 'normal' | 'good' | 'zero' };
interface Msg { id: number; role: 'user' | 'bot'; text: string; lang?: Lang; actions?: Action[]; ai?: string; notes?: string[]; error?: boolean }
interface AgentReply { reply: string; lang: Lang; actions: Action[]; ai: string }

const LOCALE: Record<Lang, string> = { en: 'en-US', hi: 'hi-IN', fr: 'fr-FR', es: 'es-ES' };
const SIM_CENTS = { low: 2100, normal: 7900, good: 12800, zero: 0 } as const;
const PAGE_OF: Record<string, string> = { '/': 'home', '/borrower': 'borrower', '/lender': 'lender', '/pay/ravi': 'pay', '/ledger': 'ledger' };

// Web Speech API (Chrome, Edge, Safari). Typed loosely because it is not in the standard DOM lib.
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number; start: () => void; stop: () => void; abort: () => void; onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null };
const SR: (new () => Recognition) | undefined = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : undefined;

function speak(text: string, lang: Lang) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LOCALE[lang];
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
    if (voice) u.voice = voice;
    u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch { /* speech output is best-effort */ }
}

export function Assistant({ s, onState }: { s: State | null; onState: (s: State) => void }) {
  const { t, lang, setLang } = useI18n();
  const nav = useNavigate();
  const loc = useLocation();
  const { start: startTour } = useTour();
  const install = useInstall();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [voiceLang, setVoiceLang] = useState<Lang>(lang);
  const [speakOn, setSpeakOn] = useState(() => { try { return localStorage.getItem('fl-voice') !== 'off'; } catch { return true; } });
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(1);

  useEffect(() => { setVoiceLang(lang); }, [lang]);
  useEffect(() => { try { localStorage.setItem('fl-voice', speakOn ? 'on' : 'off'); } catch { /* blocked */ } if (!speakOn) window.speechSynthesis?.cancel(); }, [speakOn]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs, busy]);
  useEffect(() => {
    if (!open) { recRef.current?.abort(); window.speechSynthesis?.cancel(); return; }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    const small = window.innerWidth < 1024;
    if (small) document.body.style.overflow = 'hidden';
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  const runActions = async (actions: Action[]) => {
    const small = window.innerWidth < 1024;
    let leave = false;
    for (const a of actions) {
      if (a.type === 'navigate') { nav(a.to); if (small) leave = true; }
      else if (a.type === 'set_language') setLang(a.lang);
      else if (a.type === 'start_tour') { leave = true; setTimeout(startTour, 150); }
      else if (a.type === 'install') { if (install.canInstall) await install.prompt(); }
      else if (a.type === 'prefill_request') { emitPrefill('request', a.text); leave = small; }
      else if (a.type === 'prefill_hardship') { emitPrefill('hardship', a.text); leave = true; }
    }
    if (leave) setTimeout(() => setOpen(false), 900);
  };

  async function send(textIn: string) {
    const text = textIn.trim();
    if (!text || busy) return;
    const history = msgs.slice(-6).map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
    setMsgs((m) => [...m, { id: idRef.current++, role: 'user', text }]);
    setInput(''); setBusy(true);
    try {
      const r = await api<AgentReply>('/api/agent', { text, lang, page: PAGE_OF[loc.pathname] || loc.pathname, history });
      const notes: string[] = [];
      for (const a of r.actions) {
        if (a.type === 'navigate') notes.push(t('as.opened', { page: t(`page.${a.page}`) }));
        if (a.type === 'prefill_request' || a.type === 'prefill_hardship') notes.push(t('as.filled'));
        if (a.type === 'install' && !install.canInstall) notes.push(install.installed ? t('pwa.installed') : install.ios ? t('pwa.ios') : t('pwa.unavailable'));
      }
      setMsgs((m) => [...m, { id: idRef.current++, role: 'bot', text: r.reply, lang: r.lang, actions: r.actions, ai: r.ai, notes }]);
      if (speakOn) speak(r.reply, r.lang);
      await runActions(r.actions);
    } catch (e) {
      setMsgs((m) => [...m, { id: idRef.current++, role: 'bot', text: (e as Error).message || t('as.error'), error: true }]);
    } finally { setBusy(false); }
  }

  function toggleMic() {
    setMicError(null);
    if (!SR) { setMicError(t('as.noMic')); return; }
    if (listening) { recRef.current?.stop(); return; }
    window.speechSynthesis?.cancel();
    const rec = new SR();
    rec.lang = LOCALE[voiceLang]; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    finalRef.current = '';
    rec.onresult = (e: any) => {
      let interim = ''; let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) final += r[0].transcript; else interim += r[0].transcript; }
      if (final) finalRef.current += final;
      setInput((finalRef.current + interim).trim());
    };
    rec.onerror = (e: any) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setMicError(t('as.micDenied')); else if (e.error !== 'no-speech' && e.error !== 'aborted') setMicError(t('as.error')); };
    rec.onend = () => { setListening(false); const said = finalRef.current.trim(); if (said) send(said); };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setMicError(t('as.error')); }
  }

  const onSubmit = (e: FormEvent) => { e.preventDefault(); send(input); };
  const label = (l?: Lang) => LANGS.find((x) => x.code === l)?.label || '';
  const chips = ['as.chip1', 'as.chip2', 'as.chip3', 'as.chip4', 'as.chip5'];

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button key="fab" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} data-tour="assistant" data-testid="assistant-open"
            onClick={() => setOpen(true)} aria-label={t('as.open')}
            className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-accent px-4 text-onaccent shadow-pop transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper lg:bottom-6 lg:right-6">
            <Mic width={22} height={22} /><span className="hidden text-sm font-semibold sm:inline">{t('as.open')}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div key="panel" className="fixed inset-0 z-[60] lg:pointer-events-none lg:inset-auto lg:bottom-6 lg:right-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
            <motion.section role="dialog" aria-modal="true" aria-labelledby="as-title" data-testid="assistant"
              initial={{ y: 24 }} animate={{ y: 0 }} exit={{ y: 24 }} transition={{ type: 'tween', duration: 0.18 }}
              className="card pointer-events-auto absolute inset-x-0 bottom-0 top-[6%] flex flex-col overflow-hidden rounded-b-none pb-[env(safe-area-inset-bottom)] shadow-pop lg:static lg:h-[min(640px,calc(100vh-48px))] lg:w-[400px] lg:rounded-xl2 lg:pb-0">
              <header className="flex items-start gap-3 border-b border-line px-4 py-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accentsoft text-accent"><Spark width={18} height={18} /></span>
                <div className="min-w-0 flex-1"><h2 id="as-title" className="font-semibold">{t('as.title')}</h2><p className="truncate text-xs text-muted">{t('as.sub')}</p></div>
                <button className="btn-quiet !min-h-[40px] !px-2" onClick={() => setSpeakOn(!speakOn)} aria-pressed={speakOn} aria-label={speakOn ? t('as.speakOn') : t('as.speakOff')} title={speakOn ? t('as.speakOn') : t('as.speakOff')}>{speakOn ? <Volume width={18} height={18} /> : <VolumeOff width={18} height={18} />}</button>
                {msgs.length > 0 && <button className="btn-quiet !min-h-[40px] !px-2" onClick={() => { setMsgs([]); window.speechSynthesis?.cancel(); }} aria-label={t('as.clear')} title={t('as.clear')}><Trash width={18} height={18} /></button>}
                <button className="btn-quiet !min-h-[40px] !px-2" onClick={() => setOpen(false)} aria-label={t('as.close')}><Close width={18} height={18} /></button>
              </header>

              <div ref={listRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {msgs.length === 0 && (
                  <div>
                    <p className="rounded-xl2 rounded-tl-sm bg-subtle px-3.5 py-2.5 text-sm leading-relaxed">{t('as.hello')}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {chips.map((c) => <button key={c} onClick={() => send(t(c))} className="min-h-[36px] rounded-full border border-line bg-card px-3 text-left text-[13px] text-ink hover:border-accent/40 hover:bg-subtle">{t(c)}</button>)}
                    </div>
                  </div>
                )}
                {msgs.map((m) => m.role === 'user' ? (
                  <div key={m.id} className="flex justify-end"><p className="max-w-[85%] rounded-xl2 rounded-tr-sm bg-accent px-3.5 py-2.5 text-sm leading-relaxed text-onaccent">{m.text}</p></div>
                ) : (
                  <div key={m.id} className="max-w-[92%]">
                    <div className={`rounded-xl2 rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed ${m.error ? 'border border-danger/20 bg-danger/5 text-danger' : 'bg-subtle'}`} lang={m.lang}>{m.text}</div>
                    {!m.error && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <button className="flex min-h-[28px] items-center gap-1 rounded-md px-1.5 hover:bg-subtle hover:text-ink" onClick={() => speak(m.text, m.lang || lang)} aria-label={t('as.replay')}><Volume width={13} height={13} /></button>
                        {m.ai && <span>{t(`as.by.${m.ai}`)}</span>}
                        {m.lang && m.lang !== lang && (
                          <>
                            <span aria-hidden="true">·</span><span>{t('as.repliedIn', { lang: label(m.lang) })}</span>
                            <button className="min-h-[28px] rounded-md border border-line bg-card px-2 font-medium text-ink hover:bg-subtle" onClick={() => setLang(m.lang!)}>{t('as.switchTo', { lang: label(m.lang) })}</button>
                          </>
                        )}
                      </div>
                    )}
                    {m.notes?.map((n) => <p key={n} className="mt-1 text-xs text-accent">✓ {n}</p>)}
                    {m.actions?.filter((a): a is Extract<Action, { type: 'confirm' }> => a.type === 'confirm').map((a, i) => (
                      <button key={i} className="btn-primary mt-2 !min-h-[40px] text-[13px]" disabled={busy || !s?.loan}
                        onClick={async () => { setBusy(true); try { onState(await api('/api/simulate/week', { mode: a.mode, lang })); setMsgs((x) => [...x, { id: idRef.current++, role: 'bot', text: t('sim.done') }]); } catch (e) { setMsgs((x) => [...x, { id: idRef.current++, role: 'bot', text: (e as Error).message, error: true }]); } finally { setBusy(false); } }}>
                        {t(`sim.${a.mode}`, { amount: fmt0(SIM_CENTS[a.mode]) })}
                      </button>
                    ))}
                  </div>
                ))}
                {busy && <p className="flex items-center gap-2 text-sm text-muted"><Spinner />{t('as.thinking')}</p>}
              </div>

              <footer className="border-t border-line px-3 pb-3 pt-2.5">
                {micError && <p role="alert" className="mb-2 rounded-lg bg-warmsoft px-3 py-2 text-xs text-warm">{micError}</p>}
                {listening && <p className="mb-2 flex items-center gap-2 text-xs font-medium text-accent" aria-live="assertive"><span className="flex h-3 items-end gap-0.5" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} className="w-0.5 animate-pulse rounded bg-accent" style={{ height: `${6 + (i % 2) * 6}px`, animationDelay: `${i * 120}ms` }} />)}</span>{t('as.listening')}</p>}
                <form onSubmit={onSubmit} className="flex items-center gap-2">
                  <label htmlFor="as-input" className="sr-only">{t('as.placeholder')}</label>
                  <input id="as-input" ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? t('as.listening') : t('as.placeholder')} className="input flex-1" maxLength={1000} autoComplete="off" enterKeyHint="send" lang={voiceLang} />
                  <button type="button" onClick={toggleMic} aria-pressed={listening} aria-label={listening ? t('as.stop') : t('as.mic')} title={SR ? undefined : t('as.noMic')}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${listening ? 'bg-danger text-white' : 'border border-line bg-card text-ink hover:bg-subtle'}`}>
                    {listening ? <span className="h-3 w-3 rounded-sm bg-white" /> : <Mic width={20} height={20} />}
                  </button>
                  <button type="submit" className="btn-primary !h-11 !min-h-[44px] !w-11 !px-0" disabled={!input.trim() || busy} aria-label={t('as.send')}><Send width={18} height={18} /></button>
                </form>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted">{t('as.voiceLang')}
                    <select value={voiceLang} onChange={(e) => setVoiceLang(e.target.value as Lang)} className="min-h-[32px] rounded-md border border-line bg-card px-1.5 text-xs text-ink">
                      {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                  </label>
                  <p className="text-right text-[11px] leading-snug text-muted">{t('as.safety')}</p>
                </div>
              </footer>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
