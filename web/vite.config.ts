import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  css: { postcss: path.resolve(__dirname) },
  build: { outDir: path.resolve(__dirname, '../dist'), emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
