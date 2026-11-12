import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { createApp } from './app.js';
import { createStore } from './lib/store.js';
import { createPayPalClient, createSimulatedPayPal } from './lib/paypal.js';
import { createAI } from './lib/ai.js';
import { seed } from './seed.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(root, '.env')); } catch { /* optional */ }

const env = process.env;
const paypal = env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET
  ? createPayPalClient({ clientId: env.PAYPAL_CLIENT_ID, clientSecret: env.PAYPAL_CLIENT_SECRET, base: env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com' })
  : createSimulatedPayPal();
const ai = createAI({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || 'gemini-3.6-flash' });
const store = createStore(env.DATA_FILE || path.join(root, 'data', 'db.json'), seed);
const staticDir = path.join(root, 'dist');
const app = createApp({ store, paypal, ai, staticDir: fs.existsSync(staticDir) ? staticDir : null, config: { paypalClientId: env.PAYPAL_CLIENT_ID, webhookId: env.PAYPAL_WEBHOOK_ID } });

process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e));
const port = Number(env.PORT || 3000);
app.listen(port, () => console.log(`FairLoop on http://localhost:${port}  [PayPal: ${paypal.mode}] [AI: ${ai.enabled ? `Gemini ${ai.model}` : 'offline'}]`));
