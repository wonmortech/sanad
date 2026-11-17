// SPDX-FileCopyrightText: 2026 Wonmor and Sanad contributors
// SPDX-License-Identifier: Apache-2.0

// README screenshots from the concept demo: builds it, serves it under the production CSP, visits every screen
// (dialogs open, samples verified, a CSV batch checked) and writes 1440x900 JPEGs plus one phone shot to docs/screenshots/.
// Run again whenever the demo UI changes:  npm run site:screenshots
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { build } from './build-demo.mjs'
import { start, BASE } from './serve-demo.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const DIR = join(ROOT, 'docs', 'screenshots')
mkdirSync(DIR, { recursive: true })
build()
const server = await start(4175)
const url = `http://127.0.0.1:4175${BASE}`
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined })

async function shot (name, hash, act, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: opts.phone ? 2 : 1, colorScheme: opts.dark ? 'dark' : 'light' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(url + '#' + hash)
  await page.waitForSelector('html[data-ready="1"]', { timeout: 20000 })
  await page.waitForTimeout(200)
  if (act) await act(page)
  await page.waitForTimeout(350)
  await page.screenshot({ path: join(DIR, name + '.jpg'), type: 'jpeg', quality: 78 })
  if (errors.length) throw new Error(name + ': ' + errors.join('; '))
  console.log('shot', name)
  await ctx.close()
}

try {
  await shot('overview', '/')
  await shot('credentials', '/credentials')
  await shot('credential', '/credentials/c2586')
  await shot('credential-revoked', '/credentials/c2579', async (p) => { await p.waitForSelector('.verdict') })
  await shot('issue-batch', '/issue', async (p) => { await p.click('#tab-csv'); await p.click('#is-parse'); await p.waitForSelector('#is-preview') })
  await shot('issue-done', '/issue', async (p) => { await p.click('#is-go'); await p.waitForSelector('.cert') })
  await shot('verify', '/verify', async (p) => { await p.click('[data-case="good"]'); await p.waitForSelector('.verdict.v-ok') })
  await shot('verify-forged', '/verify', async (p) => { await p.click('[data-case="name"]'); await p.waitForSelector('.verdict.v-bad'); await p.waitForTimeout(100) })
  await shot('verify-lookalike', '/verify', async (p) => { await p.click('[data-case="lookalike"]'); await p.waitForSelector('.verdict.v-bad') })
  await shot('achievements', '/achievements')
  await shot('trust', '/trust')
  await shot('holder', '/holder')
  await shot('bot', '/bot', async (p) => { await p.click('#bot-bare'); await p.click('#bot-look'); await p.waitForTimeout(200) })
  await shot('revoke-dialog', '/credentials/c2586', async (p) => { await p.click('#cr-revoke'); await p.waitForSelector('#rv-dialog[open]') })
  await shot('overview-dark', '/', null, { dark: true })
  await shot('phone', '/credentials/c2586', null, { phone: true })
} finally {
  await browser.close()
  server.close()
}
