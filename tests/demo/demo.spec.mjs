// SPDX-FileCopyrightText: 2026 Wonmor and Sanad contributors
// SPDX-License-Identifier: Apache-2.0

// Every screen of the concept demo renders real content, shows the demo note and logs no errors; the main flows work.
import { test, expect } from '@playwright/test';

const ROUTES = [
  ['/', 'Chiqarilgan sertifikatlar'], ['/credentials', 'Sertifikatlar'], ['/credentials/c2586', 'Imzolangan VC'], ['/credentials/c2579', 'Bekor qilingan'],
  ['/credentials/nope', 'Bunday sertifikat topilmadi'], ['/issue', 'Sertifikat chiqarish'], ['/achievements', 'Hakaton gʻolibi'], ['/verify', 'Namunalar'],
  ['/trust', 'Bitstring Status List'], ['/holder', 'Dilnoza Karimova'], ['/bot', 'Sanad bot'], ['/about', 'Nima haqiqiy'], ['/no-such-page', 'Sahifa topilmadi'],
];

function watch(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
async function open(page, route) {
  await page.goto('./#' + route);
  await expect(page.locator('html[data-ready="1"]')).toHaveCount(1, { timeout: 20_000 });
}

for (const [route, text] of ROUTES) {
  test(`renders ${route}`, async ({ page }) => {
    const errors = watch(page);
    await open(page, route);
    await expect(page.locator('main')).toContainText(text);
    await expect(page.locator('.demo-pill')).toContainText('qayta yuklanganda tiklanadi');
    expect(errors).toEqual([]);
  });
}

test('a path deep link becomes a hash route', async ({ page }) => {
  await page.goto('./trust');
  await expect(page.locator('main')).toContainText('Kalitlar va ishonch');
  expect(page.url()).toContain('#/trust');
});

test('verifier: every sample gives the right verdict, signatures are real', async ({ page }) => {
  const errors = watch(page);
  await open(page, '/verify');
  const cases = {
    good: ['v-ok', 'Haqiqiy'], name: ['v-bad', 'Soxta'], hours: ['v-bad', 'Soxta'], lookalike: ['v-bad', 'Soxta beruvchi'], revoked: ['v-rev', 'Bekor qilingan'],
    expired: ['v-rev', 'Muddati tugagan'], oldkey: ['v-ok', 'Haqiqiy'], other: ['v-ok', 'Haqiqiy'], unknownkey: ['v-bad', 'Notanish kalit'], broken: ['v-bad', 'Oʻqib boʻlmadi'],
  };
  for (const [key, [cls, text]] of Object.entries(cases)) {
    await page.click(`[data-case="${key}"]`);
    await expect(page.locator('.verdict.' + cls)).toContainText(text);
  }
  await page.click('[data-case="good"]');
  const json = await page.locator('#v-json').inputValue();
  await page.fill('#v-json', json.replace('Python asoslari', 'Python asoslari!'));
  await page.click('#v-check');
  await expect(page.locator('.verdict.v-bad')).toContainText('Soxta');
  expect(errors).toEqual([]);
});

test('offline mode skips the revocation check', async ({ page }) => {
  await open(page, '/verify');
  await page.check('#v-offline');
  await page.click('[data-case="revoked"]');
  await expect(page.locator('.verdict.v-ok')).toContainText('Haqiqiy');
  await expect(page.locator('#v-result')).toContainText('oflayn: status roʻyxati yuklanmadi');
});

test('issue one, then revoke it and see the verdict change', async ({ page }) => {
  const errors = watch(page);
  await open(page, '/issue');
  await page.fill('#is-name', 'Sinov Bitiruvchi');
  await page.click('#is-go');
  await expect(page.locator('.cert-name').first()).toHaveText('Sinov Bitiruvchi');
  await page.getByRole('button', { name: 'Ochish' }).click();
  await expect(page.locator('.verdict.v-ok')).toContainText('Haqiqiy');
  await page.click('#cr-revoke');
  await page.click('#rv-confirm');
  await expect(page.locator('.verdict.v-rev')).toContainText('Bekor qilingan');
  await page.click('#cr-check-off');
  await expect(page.locator('.verdict.v-ok')).toContainText('Haqiqiy');
  expect(errors).toEqual([]);
});

test('CSV batch: invalid rows are rejected, valid ones are signed', async ({ page }) => {
  await open(page, '/issue');
  await page.click('#tab-csv');
  await page.click('#is-parse');
  await expect(page.locator('#is-preview tbody tr')).toHaveCount(12);
  await expect(page.locator('#is-preview')).toContainText('ism yoʻq');
  await expect(page.locator('#is-preview')).toContainText('sana kelajakda');
  await page.click('#is-batch');
  await expect(page.locator('main')).toContainText('8 ta sertifikat chiqarildi');
  await page.goto('./#/credentials');
  await expect(page.locator('.fchip').first()).toContainText('194');
});

test('credentials: filter, search, paginate', async ({ page }) => {
  await open(page, '/credentials');
  await expect(page.locator('tbody tr')).toHaveCount(25);
  await page.click('#cr-next');
  await expect(page.locator('.pager')).toContainText('26–50');
  await page.getByRole('button', { name: /Bekor qilingan/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await page.fill('#cr-search', 'zzz');
  await expect(page.locator('.empty')).toContainText('Hech narsa topilmadi');
});

test('key rotation keeps old credentials valid', async ({ page }) => {
  await open(page, '/trust');
  await page.click('#rotate');
  await expect(page.locator('main')).toContainText('#key-2');
  await page.goto('./#/verify');
  await page.click('[data-case="oldkey"]');
  await expect(page.locator('.verdict.v-ok')).toContainText('Haqiqiy');
});

test('bot answers in two languages and flags a bare QR', async ({ page }) => {
  const errors = watch(page);
  await open(page, '/bot');
  await page.click('#bot-bare');
  await expect(page.locator('.msg.bad').last()).toContainText('imzo yoʻq');
  await page.click('#bot-lang');
  await page.click('#bot-good');
  await expect(page.locator('.msg.good').last()).toContainText('Genuine');
  expect(errors).toEqual([]);
});
