import fs from 'node:fs';
import { execSync } from 'node:child_process';
if (!fs.existsSync(new URL('../dist/index.html', import.meta.url))) {
  console.log('No build found: building the web app first…');
  execSync('npm run build', { stdio: 'inherit' });
}
await import('../server/index.js');
