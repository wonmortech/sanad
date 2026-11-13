// SPDX-FileCopyrightText: 2026 Wonmor and Sanad contributors
// SPDX-License-Identifier: Apache-2.0

// Raw V8 coverage for the combined site report (see `npm run coverage`).
//   node tools/v8-coverage.mjs clean                empties .coverage/v8
//   node tools/v8-coverage.mjs -- node <args...>    runs Node with NODE_V8_COVERAGE=.coverage/v8
// The browser tests write their Chromium coverage into the same folder (tests/e2e/fixtures.mjs), in the same
// format and with the same file:// URLs, so c8 merges unit and browser coverage per file.
import { rmSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const V8_DIR = fileURLToPath(new URL('../.coverage/v8/', import.meta.url));
const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'clean') {
  rmSync(V8_DIR, { recursive: true, force: true });
  mkdirSync(V8_DIR, { recursive: true });
} else if (cmd === '--' && rest[0] === 'node') {
  mkdirSync(V8_DIR, { recursive: true });
  const r = spawnSync(process.execPath, rest.slice(1), { stdio: 'inherit', env: { ...process.env, NODE_V8_COVERAGE: V8_DIR } });
  if (r.error) throw r.error;
  process.exit(r.status ?? 1);
} else {
  console.error('usage: node tools/v8-coverage.mjs clean | -- node <args...>');
  process.exit(2);
}
