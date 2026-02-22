import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { existsSync, cpSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @param {string} dbPath */
function generateManifest(dbPath) {
  /** @type {Record<string, number[]>} */
  const manifest = {};
  for (const entry of readdirSync(dbPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const years = readdirSync(join(dbPath, entry.name))
      .filter(f => f.endsWith('.csv'))
      .map(f => parseInt(f.replace('.csv', ''), 10))
      .filter(y => !isNaN(y))
      .sort((a, b) => a - b);
    if (years.length > 0) {
      manifest[entry.name] = years;
    }
  }
  return manifest;
}

function dbIntegration() {
  const dbDir = fileURLToPath(new URL('./db', import.meta.url));

  return {
    name: 'db-integration',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use('/db', (req, res, next) => {
          if (!existsSync(dbDir)) { next(); return; }
          if (req.url === '/manifest.json') {
            const manifest = generateManifest(dbDir);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(manifest));
            return;
          }
          const pathname = decodeURIComponent(new URL(req.url ?? '', 'http://localhost').pathname);
          const filePath = resolve(dbDir, normalize(pathname).replace(/^\/+/, ''));
          if (!filePath.startsWith(dbDir)) { next(); return; }
          if (existsSync(filePath) && !statSync(filePath).isDirectory()) {
            res.setHeader('Content-Type', 'text/csv');
            res.end(readFileSync(filePath));
            return;
          }
          next();
        });
      },
      'astro:build:done': ({ dir }) => {
        const outDb = join(fileURLToPath(dir), 'db');
        if (existsSync(dbDir)) {
          cpSync(dbDir, outDb, { recursive: true });
          const manifest = generateManifest(outDb);
          writeFileSync(join(outDb, 'manifest.json'), JSON.stringify(manifest));
        } else {
          console.warn(`[astro:build] db/ not found at ${dbDir} — DB files and manifest.json will not be included in the build.`);
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
