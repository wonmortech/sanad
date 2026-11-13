// SPDX-FileCopyrightText: 2026 Wonmor and Sanad contributors
// SPDX-License-Identifier: Apache-2.0

// Browser tests for the three home pages, the live demo, the theme, the language links and the 404 page.
import { test, expect } from './fixtures.mjs';

const PAGES = [
  { path: '/', lang: 'uz', name: 'Namuna Oʻquvchi' },
  { path: '/en/', lang: 'en', name: 'Sample Student' },
  { path: '/ru/', lang: 'ru', name: 'Образец Ученик' },
];

// Collects console errors (CSP violations land here), uncaught page errors, failed requests and dialogs.
// expected404: a path whose own 404 status Chromium reports as a console error (only the 404 page test sets it).
function watch(page, expected404) {
  const problems = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (expected404 && new URL(m.location().url || 'http://x/').pathname === expected404 && /status of 404/.test(m.text())) return;
    problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  page.on('dialog', (d) => { problems.push(`dialog: ${d.message()}`); d.dismiss(); });
  return problems;
}

for (const p of PAGES) {
  test.describe(`${p.lang} ${p.path}`, () => {
    test('loads with the production CSP and no console or page errors', async ({ page }) => {
      const problems = watch(page);
      const res = await page.goto(p.path);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-security-policy']).toMatch(/^default-src 'self'; script-src 'self'/);
      await expect(page.locator('html')).toHaveAttribute('lang', p.lang);
      await expect(page.locator('#verdict')).toHaveAttribute('data-v', 'ok');
      await page.locator('#demo').scrollIntoViewIfNeeded();
      await page.locator('footer').scrollIntoViewIfNeeded();
      await page.waitForLoadState('networkidle');
      expect(problems).toEqual([]);
    });

    test('the certificate scans to data-state="ok" without motion', async ({ page }) => {
      const problems = watch(page);
      await page.goto(p.path);
      await expect(page.locator('#cert')).toHaveAttribute('data-state', 'ok');
      await page.locator('#v-fake').click();
      await expect(page.locator('#cert')).toHaveAttribute('data-state', 'bad');
      await expect(page.locator('#cert .field.bad')).not.toHaveCount(0);
      expect(problems).toEqual([]);
    });

    test('the animated certificate scans to data-state="ok", and the forged one to "bad"', async ({ page }) => {
      const problems = watch(page);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.goto(p.path);
      const cert = page.locator('#cert');
      await expect(cert).toHaveAttribute('data-state', 'ok', { timeout: 15_000 });
      await expect(page.locator('#result')).toHaveAttribute('data-state', 'ok');
      await page.locator('#v-fake').click();
      await expect(cert).toHaveAttribute('data-state', 'bad', { timeout: 15_000 });
      await page.locator('#v-real').click();
      await expect(cert).toHaveAttribute('data-state', 'ok', { timeout: 15_000 });
      expect(problems).toEqual([]);
    });

    test('demo: a real signature check fails on edits and passes again when they are undone', async ({ page }) => {
      const problems = watch(page);
      await page.goto(p.path);
      const verdict = page.locator('#verdict'), steps = page.locator('#steps li');
      const nameIn = page.locator('#t-name-in');
      await expect(verdict).toHaveAttribute('data-v', 'ok');
      await expect(nameIn).toHaveValue(p.name);
      await expect(steps).toHaveCount(5);
      await expect(page.locator('#steps li[data-s="ok"]')).toHaveCount(5);
      await expect(page.locator('#meta')).toContainText(/Ed25519|ECDSA/);

      // typing a different name
      await nameIn.fill(p.name + 'x');
      await expect(verdict).toHaveAttribute('data-v', 'bad');
      await expect(page.locator('#t-name')).toBeChecked();
      await expect(page.locator('#cred .chg')).toHaveCount(1);
      await nameIn.fill(p.name);
      await expect(verdict).toHaveAttribute('data-v', 'ok');
      await expect(page.locator('#t-name')).not.toBeChecked();
      await expect(page.locator('#cred .chg')).toHaveCount(0);

      // the name switch
      await page.locator('#t-name').check({ force: true });
      await expect(verdict).toHaveAttribute('data-v', 'bad');
      await page.locator('#t-name').uncheck({ force: true });
      await expect(verdict).toHaveAttribute('data-v', 'ok');

      // course hours
      await page.locator('#t-hours').check({ force: true });
      await expect(verdict).toHaveAttribute('data-v', 'bad');
      await expect(page.locator('#steps li').nth(2)).toHaveAttribute('data-s', 'bad');
      await page.locator('#t-hours').uncheck({ force: true });
      await expect(verdict).toHaveAttribute('data-v', 'ok');

      // lookalike issuer: valid signature, untrusted key
      await page.locator('#t-issuer').check({ force: true });
      await expect(verdict).toHaveAttribute('data-v', 'bad');
      await expect(page.locator('#steps li').nth(2)).toHaveAttribute('data-s', 'ok');
      await expect(page.locator('#steps li').nth(3)).toHaveAttribute('data-s', 'bad');
      await page.locator('#t-issuer').uncheck({ force: true });

      // revoked: genuine but withdrawn
      await page.locator('#t-rev').check({ force: true });
      await expect(verdict).toHaveAttribute('data-v', 'rev');
      await page.locator('#t-rev').uncheck({ force: true });
      await expect(verdict).toHaveAttribute('data-v', 'ok');
      expect(problems).toEqual([]);
    });

    test('demo: markup typed into the name field is shown as text, never run', async ({ page }) => {
      const problems = watch(page);
      await page.goto(p.path);
      await expect(page.locator('#verdict')).toHaveAttribute('data-v', 'ok');
      const payload = `"><img src=x onerror="document.title='pwned'"><script>document.title='pwned'</script>`;
      await page.locator('#t-name-in').fill(payload);
      await expect(page.locator('#verdict')).toHaveAttribute('data-v', 'bad');
      await expect(page.locator('#cred img, #cred script, #steps img, #verdict img')).toHaveCount(0);
      await expect(page.locator('#cred .chg')).toContainText('<img src=x');
      expect(await page.title()).not.toBe('pwned');
      expect(problems).toEqual([]);
    });

    test('theme toggle switches, is saved and survives a reload', async ({ page }) => {
      const problems = watch(page);
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(p.path);
      const html = page.locator('html'), btn = page.locator('#theme');
      await expect(html).not.toHaveAttribute('data-theme', /./);
      const before = await btn.getAttribute('aria-label');
      await btn.click();
      await expect(html).toHaveAttribute('data-theme', 'dark');
      expect(await btn.getAttribute('aria-label')).not.toBe(before);
      expect(await page.evaluate(() => localStorage.getItem('sanad-theme'))).toBe('dark');
      await page.reload();
      await expect(html).toHaveAttribute('data-theme', 'dark');
      await btn.click();
      await expect(html).toHaveAttribute('data-theme', 'light');
      expect(problems).toEqual([]);
    });

    test('language links lead to the other pages', async ({ page }) => {
      await page.goto(p.path);
      const links = page.locator('header .lang a');
      await expect(links).toHaveCount(3);
      await expect(page.locator(`header .lang a[hreflang="${p.lang}"]`)).toHaveAttribute('aria-current', 'true');
      for (const other of PAGES.filter((o) => o !== p)) {
        await page.goto(p.path);
        await page.locator(`header .lang a[hreflang="${other.lang}"]`).click();
        await expect(page).toHaveURL((url) => url.pathname === other.path);
        await expect(page.locator('html')).toHaveAttribute('lang', other.lang);
      }
    });
  });
}

test('unknown paths get the 404 page with status 404 and no errors', async ({ page }) => {
  const problems = watch(page, '/this-page-does-not-exist/');
  const res = await page.goto('/this-page-does-not-exist/');
  expect(res.status()).toBe(404);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.nf .label')).toContainText('404');
  await page.locator('.nf a[href="/en/"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(problems).toEqual([]);
});

test('the test server never serves files outside site/', async ({ request }) => {
  for (const path of ['/..%2fpackage.json', '/%2e%2e/%2e%2e/package.json', '/assets/..%5c..%5cpackage.json', '/%E0%A4%A']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(404);
    expect(await res.text()).not.toContain('"devDependencies"');
  }
});

test('narrow screens: the menu opens, closes with Escape and closes when a section link is followed', async ({ page }) => {
  const problems = watch(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/en/');
  const btn = page.locator('#menu'), nav = page.locator('#nav');
  await expect(nav).toBeHidden();
  await btn.click();
  await expect(nav).toBeVisible();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(btn).toHaveAttribute('aria-label', 'Close menu');
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(btn).toBeFocused();
  await page.keyboard.press('Escape'); // closed already: nothing happens
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await btn.click();
  await nav.locator('a[href="#qanday"]').click();
  await expect(nav).toBeHidden();
  await expect(btn).toHaveAttribute('aria-label', 'Open menu');
  await expect(page).toHaveURL(/#qanday$/);
  expect(problems).toEqual([]);
});

test('with motion: the certificate tilts, the chain rail runs and the chat plays message by message', async ({ page }) => {
  const problems = watch(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/en/');
  const wrap = page.locator('.cert-wrap');
  await expect(wrap).toHaveAttribute('style', /rotateX\(/);
  // the pointer pulls the tilt and the gloss towards it; leaving the stage lets them settle back to the centre
  const stage = await page.locator('.stage').boundingBox();
  const gx = () => page.locator('#cert').evaluate((c) => parseFloat(c.style.getPropertyValue('--gx')));
  await page.mouse.move(stage.x + stage.width * .9, stage.y + stage.height * .1);
  await expect.poll(gx).toBeGreaterThan(60);
  await page.mouse.move(1, 1);
  await expect.poll(gx).toBeLessThan(55);

  // sections fade in as they scroll into view
  const rv = page.locator('.rv').first();
  await rv.scrollIntoViewIfNeeded();
  await expect(rv).toHaveClass(/\bin\b/);

  const rail = page.locator('svg.rail');
  await rail.scrollIntoViewIfNeeded();
  const traveller = rail.locator('.traveller');
  await expect(traveller).toHaveAttribute('transform', /^translate\(/);
  const first = await traveller.getAttribute('transform');
  await expect.poll(() => traveller.getAttribute('transform')).not.toBe(first);

  const chat = page.locator('#chat');
  await chat.scrollIntoViewIfNeeded();
  const msgs = chat.locator('.msg');
  await expect(msgs.first()).toHaveClass(/\bin\b/);
  // a typing indicator shows first, then gives way to the answer
  await expect(chat.locator('.msg[data-typing]').first()).toHaveClass(/\bin\b/);
  await expect(chat.locator('.msg[data-typing]').first()).toBeHidden({ timeout: 5_000 });
  await expect(msgs.last()).toHaveClass(/\bin\b/, { timeout: 15_000 });
  expect(problems).toEqual([]);
});

test('without motion nothing animates, and the animation starts when the visitor allows motion', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/en/');
  const wrap = page.locator('.cert-wrap');
  await expect(page.locator('#cert')).toHaveAttribute('data-state', 'ok');
  // chat: all answers shown at once, typing indicators removed
  await expect(page.locator('#chat .msg[data-typing]')).toHaveCount(0);
  await expect(page.locator('#chat .msg:not(.in)')).toHaveCount(0);
  await expect(page.locator('svg.rail .traveller')).not.toHaveAttribute('transform', /./);
  expect(await wrap.getAttribute('style')).toBeNull();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(wrap).toHaveAttribute('style', /rotateX\(/);
  expect(problems).toEqual([]);
});

test('the theme switch keeps working when storage is blocked', async ({ page }) => {
  const problems = watch(page);
  // private modes and strict settings can make localStorage throw: the theme must still switch, just not be saved
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/en/');
  const html = page.locator('html'), btn = page.locator('#theme');
  await expect(btn).toHaveAttribute('aria-label', 'Light theme');
  await btn.click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(btn).toHaveAttribute('aria-label', 'Dark theme');
  await page.reload();
  await expect(html).not.toHaveAttribute('data-theme', /./);
  expect(problems).toEqual([]);
});

test('demo: says so when the browser has no WebCrypto', async ({ page }) => {
  const problems = watch(page);
  await page.addInitScript(() => { Object.defineProperty(Crypto.prototype, 'subtle', { get: () => undefined }); });
  await page.goto('/en/');
  await expect(page.locator('#verdict b')).toHaveText(/WebCrypto is not available/);
  await expect(page.locator('#steps li')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('demo: falls back to ECDSA P-256 where Ed25519 is missing, and reports a key failure instead of hanging', async ({ page }) => {
  const problems = watch(page);
  await page.addInitScript(() => {
    const gen = SubtleCrypto.prototype.generateKey;
    SubtleCrypto.prototype.generateKey = function (alg, ...rest) {
      if (alg && alg.name === 'Ed25519') return Promise.reject(new DOMException('not supported', 'NotSupportedError'));
      if (alg && alg.name === 'ECDSA' && sessionStorage.getItem('no-ecdsa')) return Promise.reject(new DOMException('not supported', 'NotSupportedError'));
      return gen.call(this, alg, ...rest);
    };
  });
  await page.goto('/en/');
  await expect(page.locator('#verdict')).toHaveAttribute('data-v', 'ok');
  await expect(page.locator('#meta')).toContainText('ECDSA P-256');
  await page.locator('#t-hours').check({ force: true });
  await expect(page.locator('#verdict')).toHaveAttribute('data-v', 'bad');

  await page.evaluate(() => sessionStorage.setItem('no-ecdsa', '1'));
  await page.reload();
  await expect(page.locator('#verdict b')).toHaveText(/WebCrypto is not available/);
  expect(problems).toEqual([]);
});
