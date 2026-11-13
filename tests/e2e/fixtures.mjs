// SPDX-FileCopyrightText: 2026 Wonmor and Sanad contributors
// SPDX-License-Identifier: Apache-2.0

// The Playwright `test` with Chromium JS coverage: every page a test opens records V8 coverage for the scripts
// it loads (across navigations and reloads). Scripts served from site/ are written to .coverage/v8 in the
// NODE_V8_COVERAGE format with their file:// URL, so `npm run coverage` merges them with the unit-test coverage.
import { test as base, expect } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const SITE = fileURLToPath(new URL('../../site/', import.meta.url));
const OUT = fileURLToPath(new URL('../../.coverage/v8/', import.meta.url));

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await use(page);
    const entries = await page.coverage.stopJSCoverage();
    const result = [];
    for (const e of entries) {
      let path;
      try { path = new URL(e.url).pathname; } catch { continue; }
      if (!path.endsWith('.js')) continue;
      const file = join(SITE, decodeURIComponent(path));
      if (!file.startsWith(SITE) || !existsSync(file)) continue;
      result.push({ scriptId: e.scriptId, url: pathToFileURL(file).href, functions: e.functions });
    }
    if (!result.length) return;
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `coverage-browser-${randomUUID()}.json`), JSON.stringify({ result }));
  },
});

export { expect };
