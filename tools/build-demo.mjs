// SPDX-FileCopyrightText: 2026 Wonmor and Sanad contributors
// SPDX-License-Identifier: Apache-2.0

// Assembles the concept demo (demo/) into a static folder, by default dist/demo/sanad/, served at /demo/sanad/.
// The home page in site/ is not touched: the demo only copies the shared core (site/assets/js/sanad-core.js: canonical JSON, signing
// and verification helpers), the favicon and the Latin font subsets next to its own files. index.html gets absolute asset URLs
// under DEMO_BASE, so the same file also works when a static host serves it for a deeper path.
//   node tools/build-demo.mjs                        -> dist/demo/sanad/
//   DEMO_OUT=/some/dir DEMO_BASE=/x/ node tools/build-demo.mjs
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
export const BASE = process.env.DEMO_BASE || '/demo/sanad/'
export const OUT = process.env.DEMO_OUT || join(ROOT, 'dist', 'demo', 'sanad')
const FONTS = ['sans-latin', 'sans-latin-ext', 'serif-latin', 'serif-latin-ext', 'mono-latin']
// Same spirit as tools/check-site.mjs: no addresses, contacts or secrets in anything published.
const FORBIDDEN = [/(?<![\d.])\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?![\d.])/, /\+998[\s-]?\d{2}/, /\b(ghp|gho|github_pat)_[A-Za-z0-9_]{20,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\b(fkt|faktura)\.uz\b/i]

export function build (out = OUT) {
  rmSync(out, { recursive: true, force: true })
  mkdirSync(join(out, 'assets'), { recursive: true })
  mkdirSync(join(out, 'fonts'), { recursive: true })
  for (const f of readdirSync(join(ROOT, 'demo'))) cpSync(join(ROOT, 'demo', f), join(out, f))
  const index = readFileSync(join(ROOT, 'demo', 'index.html'), 'utf8').replace(/\b(href|src)="(?!https?:|#|\/)([^"]+)"/g, (m, a, u) => `${a}="${BASE}${u}"`)
  writeFileSync(join(out, 'index.html'), index)
  cpSync(join(ROOT, 'site/assets/js/sanad-core.js'), join(out, 'assets/sanad-core.js'))
  cpSync(join(ROOT, 'site/favicon.svg'), join(out, 'favicon.svg'))
  for (const f of FONTS) cpSync(join(ROOT, 'site/fonts', f + '.woff2'), join(out, 'fonts', f + '.woff2'))
  for (const f of readdirSync(join(ROOT, 'site/fonts')).filter((n) => n.startsWith('LICENSE-'))) cpSync(join(ROOT, 'site/fonts', f), join(out, 'fonts', f))

  let bytes = 0
  const errors = []
  ;(function walk (d) {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      const st = statSync(p)
      if (st.isDirectory()) { walk(p); continue }
      bytes += st.size
      if (['.html', '.js', '.css', '.svg'].includes(extname(p))) {
        const src = readFileSync(p, 'utf8').replace(/\s(d|points|viewBox|transform)="[^"]*"/g, '')
        for (const re of FORBIDDEN) { const m = src.match(re); if (m) errors.push(`${p}: forbidden text "${m[0]}"`) }
      }
    }
  })(out)
  if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
  return { out, bytes }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const r = build()
  console.log(`demo built: ${r.out} (${(r.bytes / 1024).toFixed(0)} KB)`)
}
