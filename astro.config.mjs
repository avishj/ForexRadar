import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { existsSync, cpSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function dbIntegration() {
  const dbDir = new URL('./db', import.meta.url).pathname;

  return {
    name: 'db-integration',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use('/db', (req, res, next) => {
          const filePath = join(dbDir, req.url ?? '');
          if (existsSync(filePath)) {
            res.setHeader('Content-Type', 'text/csv');
            res.end(readFileSync(filePath));
            return;
          }
          next();
        });
      },
      'astro:build:done': ({ dir }) => {
        const outDb = join(dir.pathname, 'db');
        if (existsSync(dbDir)) {
          cpSync(dbDir, outDb, { recursive: true });
        }
      },
    },
  };
}

export default defineConfig({
  output: 'static',
  outDir: 'dist',
  srcDir: 'src',
  vite: {
    plugins: [tailwindcss()],
    build: {
      sourcemap: true,
    },
  },
  integrations: [dbIntegration()],
});
