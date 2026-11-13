// Property-based tests (fast-check): canonical JSON, base64url and the signature check on random input.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fc from 'fast-check';

const core = createRequire(import.meta.url)('../../site/assets/js/sanad-core.js');
const RUNS = { numRuns: 300 };
const json = fc.jsonValue({ maxDepth: 4 });

test('canon is stable: parsing and re-canonicalising gives the same text', () => {
  fc.assert(fc.property(json, (v) => core.canon(JSON.parse(core.canon(v))) === core.canon(v)), RUNS);
});

test('canon does not depend on key order', () => {
  fc.assert(fc.property(fc.dictionary(fc.string(), json, { maxKeys: 8 }), (o) => {
    const reversed = Object.fromEntries(Object.entries(o).reverse());
    return core.canon(o) === core.canon(reversed);
  }), RUNS);
});

test('base64url round-trips any bytes and only uses the URL alphabet', () => {
  fc.assert(fc.property(fc.uint8Array({ maxLength: 512 }), (b) => {
    const s = core.b64u(b);
    assert.match(s, /^[A-Za-z0-9_-]*$/);
    assert.deepEqual(core.unb64u(s), b);
  }), RUNS);
});

test('unb64u rejects anything outside the strict alphabet', () => {
  fc.assert(fc.property(fc.string(), (s) => {
    if (/^[A-Za-z0-9_-]*$/.test(s) && s.length % 4 !== 1) return true;
    assert.throws(() => core.unb64u(s), TypeError);
    return true;
  }), RUNS);
});

test('Ed25519 rejects any changed byte of a signed message', async () => {
  const { subtle } = globalThis.crypto;
  const k = await subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
  await fc.assert(fc.asyncProperty(fc.uint8Array({ minLength: 1, maxLength: 256 }), fc.nat(), fc.integer({ min: 1, max: 255 }),
    async (msg, at, flip) => {
      const sig = await subtle.sign('Ed25519', k.privateKey, msg);
      const bad = msg.slice(); bad[at % bad.length] ^= flip;
      assert.equal(await subtle.verify('Ed25519', k.publicKey, sig, msg), true);
      assert.equal(await subtle.verify('Ed25519', k.publicKey, sig, bad), false);
    }), { numRuns: 100 });
});
