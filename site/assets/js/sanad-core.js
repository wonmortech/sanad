/* Sanad demo logic without the DOM: canonical form, encodings, signing and verification, the verdict, the strings and
   the HTML that the demo writes. Loaded as a classic script before demo.js (exposes globalThis.SanadCore) and imported
   by the unit tests in Node. Every piece of data that reaches HTML goes through esc().

   Signed input (modelled on eddsa-jcs-2022): SHA-256(canon(proof options)) || SHA-256(canon(credential without proof)).
   The proof options are everything in "proof" except proofValue, so created, purpose and key id are covered too. */
(function (g) {
  'use strict';

  var ISS = 'did:web:markaz.example', FAKE = 'did:web:rnarkaz.example';
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  var STRINGS = {
    uz: { name: 'Namuna Oʻquvchi', other: 'Boshqa Odam', course: 'Python asoslari', narrative: '72 soatlik kurs va yakuniy loyiha', issuer: 'Namuna Oʻquv Markazi', fakeIssuer: 'Namuna Oʻquv Markazi',
      hours: '144 soatlik kurs va yakuniy loyiha', s1: 'Kanonik shakl', s1d: function (n) { return n + ' bayt, kalitlar tartiblangan (JCS ga oʻxshash)'; },
      s2: 'SHA-256 xesh', s3: 'Imzo tekshiruvi', s3ok: 'imzo shu maʼlumotga mos', s3bad: 'imzo bu maʼlumotga mos emas',
      s4: 'Beruvchi ishonchli roʻyxatda', s4ok: 'did:web kaliti keshda, roʻyxatda bor', s4bad: 'bu DID ishonchli roʻyxatda yoʻq (oʻxshash nom)',
      s5: 'Bekor qilinmaganmi', s5ok: 'status roʻyxatida bit = 0', s5bad: 'status roʻyxatida bit = 1: bekor qilingan', skip: 'oʻtkazib yuborildi',
      vOk: 'Haqiqiy', vOkD: 'Imzo mos, beruvchi tanish, bekor qilinmagan.', vBad: 'Soxta', vBadD: 'Imzo mos emas: maʼlumot imzodan keyin oʻzgargan.',
      vFake: 'Soxta beruvchi', vFakeD: 'Imzo toʻgʻri, lekin uni boshqa kalit qoʻygan. Oʻxshash nom aldamaydi.', vRev: 'Bekor qilingan', vRevD: 'Imzo mos, lekin beruvchi bu sertifikatni bekor qilgan.',
      noCrypto: 'Brauzeringizda WebCrypto mavjud emas, demo ishlamaydi.', alg: function (a, ms) { return a + ' · tekshirish ' + ms + ' ms · internet ishlatilmadi'; } },
    en: { name: 'Sample Student', other: 'Someone Else', course: 'Python fundamentals', narrative: '72-hour course and a final project', issuer: 'Sample Training Centre', fakeIssuer: 'Sample Training Centre',
      hours: '144-hour course and a final project', s1: 'Canonical form', s1d: function (n) { return n + ' bytes, keys sorted (JCS-like)'; },
      s2: 'SHA-256 hash', s3: 'Signature check', s3ok: 'the signature matches this data', s3bad: 'the signature does not match this data',
      s4: 'Issuer is on the trust list', s4ok: 'did:web key is cached and trusted', s4bad: 'this DID is not on the trust list (lookalike name)',
      s5: 'Not revoked', s5ok: 'status list bit = 0', s5bad: 'status list bit = 1: revoked', skip: 'skipped',
      vOk: 'Genuine', vOkD: 'Signature matches, issuer is known, not revoked.', vBad: 'Forged', vBadD: 'Signature does not match: the data changed after signing.',
      vFake: 'Fake issuer', vFakeD: 'The signature is valid, but a different key made it. A lookalike name does not fool the check.', vRev: 'Revoked', vRevD: 'Signature matches, but the issuer has revoked this certificate.',
      noCrypto: 'WebCrypto is not available in this browser, so the demo cannot run.', alg: function (a, ms) { return a + ' · checked in ' + ms + ' ms · no network used'; } },
    ru: { name: 'Образец Ученик', other: 'Другой Человек', course: 'Основы Python', narrative: 'Курс на 72 часа и итоговый проект', issuer: 'Образец Учебный Центр', fakeIssuer: 'Образец Учебный Центр',
      hours: 'Курс на 144 часа и итоговый проект', s1: 'Каноническая форма', s1d: function (n) { return n + ' байт, ключи отсортированы (как JCS)'; },
      s2: 'Хеш SHA-256', s3: 'Проверка подписи', s3ok: 'подпись соответствует данным', s3bad: 'подпись не соответствует данным',
      s4: 'Издатель в списке доверия', s4ok: 'ключ did:web в кэше и в списке', s4bad: 'этого DID нет в списке доверия (похожее имя)',
      s5: 'Не отозван', s5ok: 'бит в списке статусов = 0', s5bad: 'бит в списке статусов = 1: отозван', skip: 'пропущено',
      vOk: 'Подлинный', vOkD: 'Подпись верна, издатель известен, не отозван.', vBad: 'Подделка', vBadD: 'Подпись не совпадает: данные изменили после подписи.',
      vFake: 'Поддельный издатель', vFakeD: 'Подпись верна, но её поставил другой ключ. Похожее имя проверку не обманет.', vRev: 'Отозван', vRevD: 'Подпись верна, но издатель отозвал этот сертификат.',
      noCrypto: 'В этом браузере нет WebCrypto, демо не работает.', alg: function (a, ms) { return a + ' · проверено за ' + ms + ' мс · без сети'; } }
  };
  function strings(lang) { return has(STRINGS, lang) ? STRINGS[lang] : null; }

  /* JCS-like canonical JSON: sorted keys, no whitespace, ES number form. Anything JSON cannot carry exactly
     (undefined, functions, NaN, Infinity, class instances) is rejected instead of being silently changed. */
  function canon(v) {
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'number') {
      if (!isFinite(v)) throw new TypeError('canon: non-finite number');
      return JSON.stringify(v);
    }
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (typeof v === 'object') {
      var p = Object.getPrototypeOf(v);
      if (p !== Object.prototype && p !== null) throw new TypeError('canon: not a plain object');
      return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    }
    throw new TypeError('canon: unsupported ' + typeof v);
  }

  function b64u(buf) {
    var s = '', b = new Uint8Array(buf);
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  /* Strict base64url: only the URL alphabet, no padding, no impossible lengths. */
  function unb64u(s) {
    if (typeof s !== 'string' || !/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) throw new TypeError('unb64u: not base64url');
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var b = atob(s), a = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return a;
  }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var ALGS = {
    ed25519: { gen: { name: 'Ed25519' }, sign: { name: 'Ed25519' }, label: 'Ed25519' },
    ecdsa: { gen: { name: 'ECDSA', namedCurve: 'P-256' }, sign: { name: 'ECDSA', hash: 'SHA-256' }, label: 'ECDSA P-256' }
  };
  /* Fresh, non-extractable key pairs: the private keys cannot be read out of WebCrypto, even by this script. */
  async function makeKeys(subtle) {
    var alg = ALGS.ed25519, issuer, attacker;
    try {
      issuer = await subtle.generateKey(alg.gen, false, ['sign', 'verify']);
      attacker = await subtle.generateKey(alg.gen, false, ['sign', 'verify']);
    } catch (e) {
      alg = ALGS.ecdsa;
      issuer = await subtle.generateKey(alg.gen, false, ['sign', 'verify']);
      attacker = await subtle.generateKey(alg.gen, false, ['sign', 'verify']);
    }
    return { alg: alg, issuer: issuer, attacker: attacker };
  }

  function base(L) {
    return {
      '@context': ['https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'],
      id: 'urn:uuid:5a1f0c2e-namuna-0001',
      type: ['VerifiableCredential', 'OpenBadgeCredential'],
      issuer: { id: ISS, type: ['Profile'], name: L.issuer },
      validFrom: '2026-10-30T00:00:00Z',
      credentialSubject: {
        type: ['AchievementSubject'], name: L.name,
        achievement: { type: ['Achievement'], name: L.course, criteria: { narrative: L.narrative } }
      },
      credentialStatus: { type: 'BitstringStatusListEntry', statusPurpose: 'revocation', statusListIndex: '7', statusListCredential: 'https://markaz.example/status/1' }
    };
  }

  /* The bytes that are signed, plus what the page shows about them. */
  async function hashData(subtle, doc) {
    var enc = new TextEncoder();
    var body = clone(doc); delete body.proof;
    var options = clone(doc.proof || {}); delete options.proofValue;
    var docBytes = enc.encode(canon(body));
    var docHash = new Uint8Array(await subtle.digest('SHA-256', docBytes));
    var optHash = new Uint8Array(await subtle.digest('SHA-256', enc.encode(canon(options))));
    var input = new Uint8Array(64);
    input.set(optHash, 0); input.set(docHash, 32);
    return { bytes: docBytes.length, docHash: docHash, input: input };
  }

  async function sign(subtle, alg, key, doc, issuerDid) {
    var d = clone(doc);
    d.proof = { type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022 (demo)', created: '2026-10-30T09:00:00Z', verificationMethod: issuerDid + '#key-1', proofPurpose: 'assertionMethod' };
    var h = await hashData(subtle, d);
    var sig = await subtle.sign(alg.sign, key.privateKey, h.input);
    d.proof.proofValue = 'u' + b64u(sig);
    return d;
  }

  /* Status list lookup that fails closed: a malformed or unknown index counts as revoked. */
  function isRevoked(statusBits, status) {
    var i = status && status.statusListIndex;
    if (typeof i !== 'string' || !/^(0|[1-9][0-9]*)$/.test(i) || !has(statusBits, i)) return true;
    return statusBits[i] !== 0;
  }

  function decide(r) { return !r.sigOk ? 'bad' : !r.trusted ? 'fake' : r.revoked ? 'rev' : 'ok'; }

  /* ctx: { resolver: {did: publicKey}, trusted: [did], statusBits: {index: 0|1} } — the verifier's offline cache. */
  async function verify(subtle, alg, doc, ctx) {
    var h = await hashData(subtle, doc);
    var proof = doc.proof || {}, vmFull = typeof proof.verificationMethod === 'string' ? proof.verificationMethod : '';
    var vm = vmFull.split('#')[0], key = has(ctx.resolver, vm) ? ctx.resolver[vm] : null, sigOk = false;
    if (key && proof.type === 'DataIntegrityProof' && proof.proofPurpose === 'assertionMethod' &&
        typeof proof.proofValue === 'string' && proof.proofValue.charAt(0) === 'u') {
      try { sigOk = await subtle.verify(alg.sign, key, unb64u(proof.proofValue.slice(1)), h.input) === true; } catch (e) { sigOk = false; }
    }
    var issuerId = doc.issuer && typeof doc.issuer.id === 'string' ? doc.issuer.id : '';
    // the key that signed must belong to the issuer named in the document, and that issuer must be trusted
    var trusted = ctx.trusted.indexOf(issuerId) >= 0 && issuerId === vm;
    var r = { bytes: h.bytes, docHash: h.docHash, vm: vm, issuer: issuerId, sigOk: sigOk, trusted: trusted, revoked: isRevoked(ctx.statusBits, doc.credentialStatus) };
    r.verdict = decide(r);
    return r;
  }

  /* The forger's edits. opts: { name: bool, nameValue: string, hours: bool } */
  function tamper(doc, opts, L) {
    var d = clone(doc);
    if (opts.name) d.credentialSubject.name = opts.nameValue !== L.name ? opts.nameValue : L.other;
    if (opts.hours) d.credentialSubject.achievement.criteria.narrative = L.hours;
    return d;
  }

  /* Pretty JSON as HTML; values that differ from ref are marked. Keys and values are escaped. */
  function render(v, ref, ind) {
    var pad = '  '.repeat(ind);
    if (Array.isArray(v)) return '[' + v.map(function (x, i) { return render(x, ref && ref[i], ind); }).join(', ') + ']';
    if (v && typeof v === 'object') {
      var ks = Object.keys(v);
      return '{\n' + ks.map(function (k, i) {
        return pad + '  <span class="k">' + esc(JSON.stringify(k)) + '</span>: ' + render(v[k], ref && ref[k], ind + 1) + (i < ks.length - 1 ? ',' : '');
      }).join('\n') + '\n' + pad + '}';
    }
    var shown = typeof v === 'string' && v.length > 46 && v.charAt(0) === 'u' ? v.slice(0, 40) + '…' : v;
    var txt = '<span class="s">' + esc(JSON.stringify(shown)) + '</span>';
    return ref !== undefined && ref !== v ? '<span class="chg">' + txt + '</span>' : txt;
  }

  var ICO = '<span class="st" aria-hidden="true"><svg class="i-ok" viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><svg class="i-x" viewBox="0 0 16 16" style="position:absolute"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></span>';
  var ICON_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var ICON_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 12h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var STATES = { ok: 1, bad: 1, skip: 1 };

  function li(title, detail, s) {
    if (!has(STATES, s)) throw new TypeError('li: unknown state');
    return '<li data-s="' + s + '">' + ICO + '<div><b>' + esc(title) + '</b><span class="d">' + esc(detail) + '</span></div></li>';
  }
  function stepsHtml(L, r, algLabel) {
    var html = li(L.s1, L.s1d(r.bytes), 'ok') + li(L.s2, hex(r.docHash).slice(0, 32) + '…', 'ok') +
      li(L.s3, (r.sigOk ? L.s3ok : L.s3bad) + ' · ' + algLabel + ' · ' + r.vm, r.sigOk ? 'ok' : 'bad');
    html += r.sigOk ? li(L.s4, (r.trusted ? L.s4ok : L.s4bad) + ' · ' + r.issuer, r.trusted ? 'ok' : 'bad') : li(L.s4, L.skip, 'skip');
    html += r.sigOk && r.trusted ? li(L.s5, r.revoked ? L.s5bad : L.s5ok, r.revoked ? 'bad' : 'ok') : li(L.s5, L.skip, 'skip');
    return html;
  }
  /* Returns the data-v state and the inner HTML of the verdict box. */
  function verdictView(L, verdict) {
    var v = verdict === 'bad' ? ['bad', L.vBad, L.vBadD, ICON_X] : verdict === 'fake' ? ['bad', L.vFake, L.vFakeD, ICON_X] :
      verdict === 'rev' ? ['rev', L.vRev, L.vRevD, ICON_R] : verdict === 'ok' ? ['ok', L.vOk, L.vOkD, ICON_OK] : null;
    if (!v) throw new TypeError('verdictView: unknown verdict');
    return { state: v[0], html: v[3] + '<div><b>' + esc(v[1]) + '</b><span>' + esc(v[2]) + '</span></div>' };
  }

  var api = {
    ISS: ISS, FAKE: FAKE, ALGS: ALGS, strings: strings, langs: Object.keys(STRINGS),
    canon: canon, b64u: b64u, unb64u: unb64u, hex: hex, clone: clone, esc: esc,
    makeKeys: makeKeys, base: base, hashData: hashData, sign: sign, verify: verify, isRevoked: isRevoked, decide: decide,
    tamper: tamper, render: render, li: li, stepsHtml: stepsHtml, verdictView: verdictView
  };
  g.SanadCore = Object.freeze(api);
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
