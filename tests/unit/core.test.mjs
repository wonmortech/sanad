// Unit tests for site/assets/js/sanad-core.js, the demo logic the browser runs. Node 24 ships WebCrypto with Ed25519.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const C = require('../../site/assets/js/sanad-core.js');
const { subtle } = globalThis.crypto;

const L = C.strings('en');
const keysOnce = C.makeKeys(subtle);

async function setup() {
  const keys = await keysOnce;
  const ctx = { resolver: { [C.ISS]: keys.issuer.publicKey, [C.FAKE]: keys.attacker.publicKey }, trusted: [C.ISS], statusBits: { 7: 0 } };
  const original = await C.sign(subtle, keys.alg, keys.issuer, C.base(L), C.ISS);
  const f = C.base(L); f.issuer.id = C.FAKE;
  const fake = await C.sign(subtle, keys.alg, keys.attacker, f, C.FAKE);
  return { keys, ctx, original, fake };
}

describe('module', () => {
  test('is exposed on globalThis for the classic browser script and frozen', () => {
    assert.equal(globalThis.SanadCore, C);
    assert.ok(Object.isFrozen(globalThis.SanadCore));
    assert.equal(typeof globalThis.SanadCore.verify, 'function');
  });
});

describe('canon', () => {
  test('sorts keys at every level and drops whitespace', () => {
    assert.equal(C.canon({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } }), '{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}');
  });
  test('is independent of insertion order', () => {
    assert.equal(C.canon({ x: 1, y: 2 }), C.canon({ y: 2, x: 1 }));
  });
  test('sorts by UTF-16 code units like JCS', () => {
    assert.equal(C.canon({ 'é': 1, z: 2, A: 3 }), '{"A":3,"z":2,"é":1}');
  });
  test('uses JSON string escaping, so quotes and control characters cannot break out', () => {
    assert.equal(C.canon('a"b\\c\n'), '"a\\"b\\\\c\\n"');
    assert.equal(C.canon({ 'k"': '}' }), '{"k\\"":"}"}');
  });
  test('keeps booleans, numbers and null exact', () => {
    assert.equal(C.canon([true, false, 0, -1.5, 1e21, null]), '[true,false,0,-1.5,1e+21,null]');
  });
  test('rejects values JSON cannot carry exactly', () => {
    for (const bad of [undefined, () => 1, NaN, Infinity, -Infinity, 10n, Symbol('s'), new Date(0), { a: undefined }, [undefined]]) {
      assert.throws(() => C.canon(bad), TypeError);
    }
  });
  test('accepts null-prototype objects', () => {
    const o = Object.create(null); o.b = 1; o.a = 2;
    assert.equal(C.canon(o), '{"a":2,"b":1}');
  });
});

describe('encodings', () => {
  test('base64url round trip for every byte value and length', () => {
    for (let n = 0; n < 70; n++) {
      const b = new Uint8Array(n).map((_, i) => (i * 37 + n) & 255);
      const s = C.b64u(b);
      assert.match(s, /^[A-Za-z0-9_-]*$/);
      assert.deepEqual(C.unb64u(s), b);
    }
  });
  test('base64url known vectors (RFC 4648)', () => {
    const enc = (t) => C.b64u(new TextEncoder().encode(t));
    assert.equal(enc(''), ''); assert.equal(enc('f'), 'Zg'); assert.equal(enc('fo'), 'Zm8'); assert.equal(enc('foo'), 'Zm9v');
    assert.equal(C.b64u(new Uint8Array([251, 255])), '-_8');
  });
  test('unb64u rejects other alphabets, padding and impossible lengths', () => {
    for (const bad of ['Zg==', 'a+b/', 'abc$', 'a', 'abcde', 12, null]) assert.throws(() => C.unb64u(bad), TypeError);
  });
  test('hex', () => {
    assert.equal(C.hex(new Uint8Array([0, 1, 15, 16, 255])), '00010f10ff');
    assert.equal(C.hex(new Uint8Array([171, 205]).buffer), 'abcd');
  });
  test('clone is deep', () => {
    const a = { x: { y: [1] } }, b = C.clone(a);
    b.x.y.push(2);
    assert.deepEqual(a, { x: { y: [1] } });
  });
});

describe('esc', () => {
  test('escapes all HTML-significant characters', () => {
    assert.equal(C.esc(`<a href="x" onclick='y'>&</a>`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
    assert.equal(C.esc(5), '5');
  });
});

describe('strings', () => {
  test('uz, en and ru have the same keys and every value is non-empty', () => {
    const keys = Object.keys(C.strings('uz')).sort();
    assert.deepEqual(C.langs.sort(), ['en', 'ru', 'uz']);
    for (const lang of C.langs) {
      const s = C.strings(lang);
      assert.deepEqual(Object.keys(s).sort(), keys, lang);
      for (const [k, v] of Object.entries(s)) {
        const out = typeof v === 'function' ? v(12, '1.0') : v;
        assert.equal(typeof out, 'string', `${lang}.${k}`);
        assert.ok(out.trim().length > 0, `${lang}.${k}`);
      }
      assert.match(s.s1d(321), /321/);
      assert.match(s.alg('Ed25519', '0.4'), /Ed25519.*0\.4/);
      assert.notEqual(s.other, s.name);
    }
  });
  test('unknown or inherited language names give null', () => {
    for (const l of ['de', '', 'constructor', '__proto__', 'toString']) assert.equal(C.strings(l), null);
  });
});

describe('sign and verify', () => {
  test('the issued certificate is genuine', async () => {
    const { keys, ctx, original } = await setup();
    assert.equal(keys.alg.label, 'Ed25519');
    assert.match(original.proof.proofValue, /^u[A-Za-z0-9_-]{86}$/);
    assert.equal(original.proof.verificationMethod, C.ISS + '#key-1');
    const r = await C.verify(subtle, keys.alg, original, ctx);
    assert.deepEqual([r.sigOk, r.trusted, r.revoked, r.verdict], [true, true, false, 'ok']);
    assert.equal(r.vm, C.ISS); assert.equal(r.issuer, C.ISS);
    assert.equal(r.bytes, new TextEncoder().encode(C.canon((({ proof, ...b }) => b)(original))).length);
  });
  test('signing does not mutate its input', async () => {
    const { keys } = await setup();
    const doc = C.base(L), before = JSON.stringify(doc);
    await C.sign(subtle, keys.alg, keys.issuer, doc, C.ISS);
    assert.equal(JSON.stringify(doc), before);
  });
  test('the signed input is SHA-256(proof options) || SHA-256(document)', async () => {
    const { original } = await setup();
    const h = await C.hashData(subtle, original);
    const { proof, ...body } = original; const { proofValue, ...opts } = proof;
    const sha = async (t) => new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(t)));
    assert.deepEqual(h.docHash, await sha(C.canon(body)));
    assert.deepEqual(h.input.slice(0, 32), await sha(C.canon(opts)));
    assert.deepEqual(h.input.slice(32), h.docHash);
  });
  test('changing any signed field, including proof options, makes it forged', async () => {
    const { keys, ctx, original } = await setup();
    const edits = [
      (d) => { d.credentialSubject.name = 'Someone Else'; },
      (d) => { d.credentialSubject.achievement.criteria.narrative = L.hours; },
      (d) => { d.validFrom = '2020-01-01T00:00:00Z'; },
      (d) => { d.credentialStatus.statusListIndex = '8'; },
      (d) => { d.proof.created = '2030-01-01T00:00:00Z'; },
      (d) => { d.proof.cryptosuite = 'none'; },
      (d) => { d.extra = 1; },
      (d) => { d.type.reverse(); },
    ];
    for (const edit of edits) {
      const d = C.clone(original); edit(d);
      const r = await C.verify(subtle, keys.alg, d, ctx);
      assert.equal(r.verdict, 'bad', edit.toString());
    }
  });
  test('reordering keys keeps it genuine (canonical form)', async () => {
    const { keys, ctx, original } = await setup();
    const reordered = Object.fromEntries(Object.entries(original).reverse());
    assert.equal((await C.verify(subtle, keys.alg, reordered, ctx)).verdict, 'ok');
  });
  test('a lookalike issuer with its own valid signature is a fake issuer', async () => {
    const { keys, ctx, fake } = await setup();
    const r = await C.verify(subtle, keys.alg, fake, ctx);
    assert.deepEqual([r.sigOk, r.trusted, r.verdict], [true, false, 'fake']);
  });
  test('claiming the trusted issuer while signing with another key fails', async () => {
    const { keys, ctx, fake } = await setup();
    const d = C.clone(fake); d.issuer.id = C.ISS; // signature now covers different data
    assert.equal((await C.verify(subtle, keys.alg, d, ctx)).verdict, 'bad');
    const resigned = await C.sign(subtle, keys.alg, keys.attacker, (({ proof, ...b }) => b)(d), C.ISS);
    assert.equal((await C.verify(subtle, keys.alg, resigned, ctx)).verdict, 'bad', 'attacker key under the issuer key id');
  });
  test('issuer named in the document must match the signing key', async () => {
    const { keys, ctx } = await setup();
    const doc = C.base(L); // names markaz as issuer but is signed with the lookalike key id
    const d = await C.sign(subtle, keys.alg, keys.attacker, doc, C.FAKE);
    const r = await C.verify(subtle, keys.alg, d, { ...ctx, trusted: [C.ISS, C.FAKE] });
    assert.deepEqual([r.sigOk, r.trusted, r.verdict], [true, false, 'fake']);
  });
  test('revoked when the status bit is set', async () => {
    const { keys, ctx, original } = await setup();
    const r = await C.verify(subtle, keys.alg, original, { ...ctx, statusBits: { 7: 1 } });
    assert.deepEqual([r.sigOk, r.trusted, r.revoked, r.verdict], [true, true, true, 'rev']);
  });
  test('broken or missing proofs never verify', async () => {
    const { keys, ctx, original } = await setup();
    const cases = [
      (d) => { delete d.proof; },
      (d) => { d.proof.proofValue = d.proof.proofValue.slice(1); },
      (d) => { d.proof.proofValue = 'z' + d.proof.proofValue.slice(1); },
      (d) => { d.proof.proofValue = 'u!!!'; },
      (d) => { d.proof.proofValue = 'u'; },
      (d) => { d.proof.proofValue = 42; },
      (d) => { d.proof.verificationMethod = 'did:web:unknown.example#key-1'; },
      (d) => { d.proof.verificationMethod = '__proto__#key-1'; },
      (d) => { d.proof.verificationMethod = 'constructor'; },
      (d) => { d.proof.verificationMethod = 7; },
      (d) => { d.proof.type = 'Ed25519Signature2020'; },
      (d) => { d.proof.proofPurpose = 'authentication'; },
    ];
    for (const edit of cases) {
      const d = C.clone(original); edit(d);
      const r = await C.verify(subtle, keys.alg, d, ctx);
      assert.equal(r.sigOk, false, edit.toString());
      assert.equal(r.verdict, 'bad', edit.toString());
    }
  });
  test('missing issuer is not trusted', async () => {
    const { keys, ctx, original } = await setup();
    const d = C.clone(original); delete d.issuer;
    const r = await C.verify(subtle, keys.alg, d, ctx);
    assert.equal(r.issuer, ''); assert.equal(r.trusted, false);
  });
  test('falls back to ECDSA P-256 when Ed25519 is missing, and that path verifies too', async () => {
    const noEd = {
      generateKey: (alg, ...rest) => alg.name === 'Ed25519' ? Promise.reject(new Error('NotSupportedError')) : subtle.generateKey(alg, ...rest),
    };
    const keys = await C.makeKeys(noEd);
    assert.equal(keys.alg, C.ALGS.ecdsa);
    assert.equal(keys.issuer.privateKey.extractable, false);
    const ctx = { resolver: { [C.ISS]: keys.issuer.publicKey }, trusted: [C.ISS], statusBits: { 7: 0 } };
    const d = await C.sign(subtle, keys.alg, keys.issuer, C.base(L), C.ISS);
    assert.equal((await C.verify(subtle, keys.alg, d, ctx)).verdict, 'ok');
    d.credentialSubject.name = 'x';
    assert.equal((await C.verify(subtle, keys.alg, d, ctx)).verdict, 'bad');
  });
  test('private keys are not extractable', async () => {
    const { keys } = await setup();
    assert.equal(keys.issuer.privateKey.extractable, false);
    await assert.rejects(subtle.exportKey('pkcs8', keys.issuer.privateKey));
  });
});

describe('isRevoked and decide', () => {
  test('status lookup fails closed', () => {
    const bits = { 7: 0, 8: 1 };
    assert.equal(C.isRevoked(bits, { statusListIndex: '7' }), false);
    assert.equal(C.isRevoked(bits, { statusListIndex: '8' }), true);
    for (const s of [undefined, null, {}, { statusListIndex: 7 }, { statusListIndex: '9' }, { statusListIndex: '07' }, { statusListIndex: '7abc' }, { statusListIndex: '-7' }, { statusListIndex: '__proto__' }]) {
      assert.equal(C.isRevoked(bits, s), true, JSON.stringify(s));
    }
  });
  test('verdict order: signature, then trust, then status', () => {
    assert.equal(C.decide({ sigOk: false, trusted: true, revoked: false }), 'bad');
    assert.equal(C.decide({ sigOk: true, trusted: false, revoked: true }), 'fake');
    assert.equal(C.decide({ sigOk: true, trusted: true, revoked: true }), 'rev');
    assert.equal(C.decide({ sigOk: true, trusted: true, revoked: false }), 'ok');
  });
});

describe('tamper', () => {
  test('applies the forger edits without touching the original', () => {
    const doc = C.base(L);
    assert.deepEqual(C.tamper(doc, {}, L), doc);
    assert.equal(C.tamper(doc, { name: true, nameValue: 'Mallory' }, L).credentialSubject.name, 'Mallory');
    assert.equal(C.tamper(doc, { name: true, nameValue: L.name }, L).credentialSubject.name, L.other);
    assert.equal(C.tamper(doc, { hours: true }, L).credentialSubject.achievement.criteria.narrative, L.hours);
    assert.equal(doc.credentialSubject.name, L.name);
  });
});

describe('HTML output', () => {
  const XSS = `"><img src=x onerror=alert(1)><script>alert(2)</script>'`;
  const tags = (html) => [...html.matchAll(/<([a-z]+)/g)].map((m) => m[1]);

  test('render escapes user-controlled values and keys', () => {
    const doc = C.tamper(C.base(L), { name: true, nameValue: XSS }, L);
    doc[XSS] = XSS;
    const html = C.render(doc, C.base(L), 0);
    assert.deepEqual([...new Set(tags(html))], ['span']);
    assert.ok(!html.includes('<img') && !html.includes('<script'));
  });
  test('render marks changed values only', () => {
    const doc = C.base(L);
    assert.ok(!C.render(doc, doc, 0).includes('chg'));
    const html = C.render(C.tamper(doc, { name: true, nameValue: 'Mallory' }, L), doc, 0);
    assert.equal(html.match(/class="chg"/g).length, 1);
    assert.match(html, /<span class="chg"><span class="s">&quot;Mallory&quot;<\/span><\/span>/);
  });
  test('render shortens long proof values and nests arrays', () => {
    const html = C.render({ p: 'u' + 'A'.repeat(80), a: [1, [2]] }, undefined, 0);
    assert.match(html, /&quot;uAAAA[A]*…&quot;/);
    assert.ok(html.includes('[<span class="s">1</span>, [<span class="s">2</span>]]'));
  });
  test('steps for every outcome, escaped', () => {
    const r = { bytes: 10, docHash: new Uint8Array(32).fill(171), vm: XSS, issuer: XSS };
    const ok = C.stepsHtml(L, { ...r, sigOk: true, trusted: true, revoked: false }, 'Ed25519');
    assert.deepEqual(ok.match(/data-s="(\w+)"/g), ['data-s="ok"', 'data-s="ok"', 'data-s="ok"', 'data-s="ok"', 'data-s="ok"']);
    assert.ok(ok.includes('abababab') && !ok.includes('<img'));
    const rev = C.stepsHtml(L, { ...r, sigOk: true, trusted: true, revoked: true }, 'Ed25519');
    assert.ok(rev.includes(L.s5bad));
    const fake = C.stepsHtml(L, { ...r, sigOk: true, trusted: false, revoked: false }, 'Ed25519');
    assert.equal(fake.match(/data-s="skip"/g).length, 1);
    const bad = C.stepsHtml(L, { ...r, sigOk: false, trusted: false, revoked: false }, 'Ed25519');
    assert.equal(bad.match(/data-s="skip"/g).length, 2);
    assert.ok(bad.includes(L.s3bad));
  });
  test('li accepts only known states', () => {
    assert.throws(() => C.li('a', 'b', '" onmouseover="x'), TypeError);
  });
  test('verdict view for each verdict', () => {
    assert.deepEqual(Object.fromEntries(['ok', 'bad', 'fake', 'rev'].map((v) => [v, C.verdictView(L, v).state])), { ok: 'ok', bad: 'bad', fake: 'bad', rev: 'rev' });
    assert.ok(C.verdictView(L, 'fake').html.includes(L.vFake));
    assert.throws(() => C.verdictView(L, 'maybe'), TypeError);
  });
});
