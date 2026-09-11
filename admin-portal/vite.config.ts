import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

function installAdminSlashRedirect(server: { middlewares: { use(handler: (request: { url?: string }, response: { statusCode: number; setHeader(name: string, value: string): void; end(): void }, next: () => void) => void): void } }) {
  server.middlewares.use((request,response,next)=>{
    if(request.url==='/admin'||request.url?.startsWith('/admin?')){
      response.statusCode=307;
      response.setHeader('Location','/admin/');
      response.end();
      return;
    }
    next();
  });
}

export const adminSlashRedirect:Plugin={
  name:'pxpress-admin-slash-redirect',
  configureServer:installAdminSlashRedirect,
  configurePreviewServer:installAdminSlashRedirect,
};

export default defineConfig({ base: '/admin/', resolve: { alias: [{ find: /^lucide-react$/, replacement: resolve(import.meta.dirname, 'build/lucide-react-shim.mjs') }] }, plugins: [adminSlashRedirect,react()], test: { environment: 'jsdom', setupFiles: './src/test/setup.ts' } });
