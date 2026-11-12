import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;
export default {
  darkMode: 'class',
  content: [path.join(dir, 'index.html'), path.join(dir, 'src/**/*.{ts,tsx}')],
  theme: {
    extend: {
      fontFamily: {
        display: ['Geist', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
        sans: ['Geist', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        paper: c('paper'), card: c('card'), ink: c('ink'), muted: c('muted'), line: c('line'), sidebar: c('sidebar'), subtle: c('subtle'),
        accent: c('accent'), accentsoft: c('accentsoft'), onaccent: c('onaccent'), warm: c('warm'), warmsoft: c('warmsoft'),
        danger: c('danger'), info: c('info'), infosoft: c('infosoft'),
      },
      boxShadow: {
        soft: '0 1px 2px rgb(16 24 32 / 0.04)',
        pop: '0 12px 32px -12px rgb(16 24 32 / 0.25), 0 2px 6px rgb(16 24 32 / 0.06)',
      },
      borderRadius: { xl2: '12px' },
    },
  },
};
