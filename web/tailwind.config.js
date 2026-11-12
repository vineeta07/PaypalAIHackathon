import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
export default {
  darkMode: 'class',
  content: [path.join(dir, 'index.html'), path.join(dir, 'src/**/*.{ts,tsx}')],
  theme: {
    extend: {
      fontFamily: { display: ['Fraunces', 'Georgia', 'serif'], sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        paper: 'rgb(var(--paper) / <alpha-value>)', card: 'rgb(var(--card) / <alpha-value>)', ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)', line: 'rgb(var(--line) / <alpha-value>)', accent: 'rgb(var(--accent) / <alpha-value>)',
        accentsoft: 'rgb(var(--accentsoft) / <alpha-value>)', warm: 'rgb(var(--warm) / <alpha-value>)', warmsoft: 'rgb(var(--warmsoft) / <alpha-value>)', danger: 'rgb(var(--danger) / <alpha-value>)',
      },
      boxShadow: { soft: '0 1px 2px rgb(16 24 40 / 0.04), 0 8px 24px -8px rgb(16 24 40 / 0.10)' },
      borderRadius: { xl2: '14px' },
    },
  },
};
