// Browser tests for the three home pages, the live demo, the theme, the language links and the 404 page.
import { test, expect } from '@playwright/test';

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
