import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Keep production bundling independent from Vitest's worker/runtime setup.
// The development-only /admin redirect is reproduced by Netlify's redirect file.
export default defineConfig({
  base: '/admin/',
  resolve: {
    alias: [{ find: /^lucide-react$/, replacement: resolve(import.meta.dirname, 'build/lucide-react-shim.mjs') }],
  },
  plugins: [react()],
});
