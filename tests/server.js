/**
 * Simple static file server for Playwright tests.
 * Serves built Astro output from dist/ on localhost:3000.
 */

import { existsSync } from 'fs';
import { join, extname } from 'path';

const PORT = 3000;
const ROOT_DIR = join(import.meta.dir, '..', 'dist');
const INDEX_FILE = join(ROOT_DIR, 'index.html');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

if (!existsSync(INDEX_FILE)) {
  console.error('Missing dist/index.html. Run "bun run build" before starting tests.');
  process.exit(1);
}

Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    let pathname = url.pathname;
    
    // Default to index.html
    if (pathname === '/') {
      pathname = '/index.html';
    }
    
    const filePath = join(ROOT_DIR, pathname);
    
    // Security: prevent path traversal
    if (!filePath.startsWith(ROOT_DIR)) {
      return new Response('Forbidden', { status: 403 });
    }
    
    if (!existsSync(filePath)) {
      return new Response('Not Found', { status: 404 });
    }
    
    const file = Bun.file(filePath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    return new Response(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      },
    });
  },
});

console.log(`📡 Test server running from dist/ at http://localhost:${PORT}`);
