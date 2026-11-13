// SPDX-FileCopyrightText: 2026 Wonmor and Sanad contributors
// SPDX-License-Identifier: Apache-2.0

// Dependency-free static server for site/, used by the e2e tests (and `npm run serve`).
// It sends the security headers from deploy/Caddyfile, so a CSP violation fails the tests the same way it would
// break the live site, and it answers unknown paths with 404.html and status 404, like Caddy's handle_errors.
import http from 'node:http';
import { readFileSync, statSync, createReadStream } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../site/', import.meta.url));
const ROOT_ABS = resolve(ROOT);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.json': 'application/json',
};

// Production headers: every `Name "value"` / `Name value` line inside the first `header {` block of the Caddyfile.
export function productionHeaders(caddyfile = readFileSync(new URL('../deploy/Caddyfile', import.meta.url), 'utf8')) {
  const block = caddyfile.match(/\n\s*header\s*\{([\s\S]*?)\n\s*\}/);
  if (!block) throw new Error('serve: no header block in deploy/Caddyfile');
  const out = {};
  for (const line of block[1].split('\n')) {
    const m = line.trim().match(/^([A-Za-z-]+)\s+(?:"([^"]*)"|(\S+))$/);
    if (m) out[m[1]] = m[2] ?? m[3];
  }
  if (!out['Content-Security-Policy']) throw new Error('serve: no Content-Security-Policy in deploy/Caddyfile');
  return out;
}

const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };

// Maps a URL path to a file inside site/, or null. Never leaves site/.
export function resolvePath(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath); } catch { return null; }
  if (p.includes('\0')) return null;
  const f = resolve(join(ROOT_ABS, p));
  if (f !== ROOT_ABS && !f.startsWith(ROOT_ABS + sep)) return null;
  if (isFile(f)) return f;
  if (isFile(join(f, 'index.html'))) return join(f, 'index.html');
  return null;
}

export function createServer() {
  const headers = { ...productionHeaders(), 'Cache-Control': 'no-store' };
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
    const path = new URL(req.url, 'http://localhost').pathname;
    // a directory without a trailing slash redirects, so relative links resolve as they do behind Caddy
    let f = resolvePath(path), status = 200;
    if (f && !path.endsWith('/') && f.endsWith(sep + 'index.html') && !path.endsWith('index.html')) {
      res.writeHead(308, { ...headers, Location: path + '/' }); return res.end();
    }
    if (!f) { f = join(ROOT_ABS, '404.html'); status = 404; }
    res.writeHead(status, { ...headers, 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' });
    if (req.method === 'HEAD') return res.end();
    createReadStream(f).pipe(res);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4392);
  createServer().listen(port, '127.0.0.1', () => console.log(`serving ${ROOT_ABS} on http://127.0.0.1:${port}`));
}
