// Checks site/ before CI deploys it. No dependencies, no build: site/ is served as it is.
// Fails on: missing required pages, broken local links, inline <script> (the CSP blocks it),
// third-party origins in src/srcset/url() (the CSP blocks them), and text that must never be published.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../site/', import.meta.url));
const REQUIRED = ['index.html', 'en/index.html', 'ru/index.html', '404.html', 'robots.txt', 'sitemap.xml', 'favicon.svg'];
// Server addresses, internal hostnames, personal contact data, secrets.
const FORBIDDEN = [
  /(?<![\d.])\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?![\d.])/,
  /\b(gitlab|jira|grafana|status)\.(fkt|faktura)\.uz\b/i,
  /\b[\w.+-]+@(gmail|mail|yandex|inbox)\.(com|ru)\b/i,
  /\+998[\s-]?\d{2}/,
  /\b(ghp|gho|github_pat)_[A-Za-z0-9_]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
const TEXT = new Set(['.html', '.css', '.js', '.mjs', '.svg', '.txt', '.xml', '.json', '.webmanifest']);

const errors = [];
const files = [];
(function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(p); } })(ROOT);
const rel = (p) => relative(ROOT, p).split('\\').join('/');

for (const r of REQUIRED) if (!existsSync(join(ROOT, r))) errors.push(`missing ${r}`);

const resolveLocal = (from, url) => {
  const clean = decodeURI(url.split('#')[0].split('?')[0]);
  if (!clean) return null;
  let p = clean.startsWith('/') ? join(ROOT, clean) : join(dirname(from), clean);
  if (clean.endsWith('/')) p = join(p, 'index.html');
  return p;
};
const missing = (p) => p && !existsSync(p) && !existsSync(p + '.html') && !existsSync(join(p, 'index.html'));

for (const f of files) {
  const ext = extname(f).toLowerCase();
  if (!TEXT.has(ext)) continue;
  const vendor = /(^|\/)vendor\//.test(rel(f));
  const src = readFileSync(f, 'utf8');
  // SVG geometry (d, points, viewBox, transform) is all numbers and can look like an address, so it is not scanned.
  const scan = src.replace(/\s(d|points|viewBox|transform)="[^"]*"/g, '');
  if (!vendor) for (const re of FORBIDDEN) { const m = scan.match(re); if (m) errors.push(`${rel(f)}: forbidden text "${m[0]}"`); }
  if (ext === '.html') {
    if (!/<html[^>]+lang="/.test(src)) errors.push(`${rel(f)}: <html> has no lang`);
    if (!/<title>[^<]+<\/title>/.test(src)) errors.push(`${rel(f)}: no <title>`);
    for (const m of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi)) {
      if (/type="application\/(ld\+)?json"/.test(m[1])) continue;
      if (!/\bsrc=/.test(m[1]) || m[2].trim()) errors.push(`${rel(f)}: inline <script> (blocked by the CSP)`);
    }
    if (/<[a-z][^>]*\son[a-z]+\s*=\s*["']/i.test(src)) errors.push(`${rel(f)}: inline event handler (blocked by the CSP)`);
    for (const m of src.matchAll(/\b(?:src|srcset|poster)="([^"]+)"/g)) {
      for (const u of m[1].split(',').map((s) => s.trim().split(/\s+/)[0])) {
        if (/^(https?:)?\/\//.test(u)) { errors.push(`${rel(f)}: third-party resource ${u}`); continue; }
        if (/^(data|blob):/.test(u)) continue;
        if (missing(resolveLocal(f, u))) errors.push(`${rel(f)}: missing ${u}`);
      }
    }
    for (const m of src.matchAll(/<link\b[^>]*>/g)) {
      const h = m[0].match(/\bhref="([^"]+)"/); if (!h) continue; const u = h[1];
      if (/^(https?:)?\/\//.test(u)) { if (/rel="(stylesheet|preload|modulepreload|icon|manifest)"/.test(m[0])) errors.push(`${rel(f)}: third-party ${u}`); continue; }
      if (missing(resolveLocal(f, u))) errors.push(`${rel(f)}: missing ${u}`);
    }
    for (const m of src.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
      const u = m[1]; if (/^(https?:|mailto:|tel:|#)/.test(u)) continue;
      if (missing(resolveLocal(f, u))) errors.push(`${rel(f)}: broken link ${u}`);
    }
  }
  if (ext === '.css') for (const m of src.matchAll(/url\(\s*['"]?([^'")]+)/g)) {
    const u = m[1]; if (/^(data|blob):|^#/.test(u)) continue;
    if (/^(https?:)?\/\//.test(u)) { errors.push(`${rel(f)}: third-party ${u}`); continue; }
    if (missing(resolveLocal(f, u))) errors.push(`${rel(f)}: missing ${u}`);
  }
}

if (errors.length) { console.error(errors.map((e) => '  ' + e).join('\n')); console.error(`check-site: ${errors.length} problem(s)`); process.exit(1); }
console.log(`check-site ok: ${files.length} files`);
