/* Sanad in-browser demo. A real Ed25519 signature (WebCrypto) over a simplified Open Badges 3.0 style credential.
   Simplified on purpose: JSON keys are sorted (JCS-like), the SHA-256 of that text is signed, and the "did:web" lookup and
   the revocation list are local, cached objects. Keys are made fresh in your browser on every load and never leave it. */
(function () {
  'use strict';
  var root = document.getElementById('demo');
  if (!root) return;
  var lang = (document.documentElement.lang || 'uz').slice(0, 2);
  var subtle = window.crypto && window.crypto.subtle;

  var L = {
    uz: { name: 'Namuna Oʻquvchi', course: 'Python asoslari', narrative: '72 soatlik kurs va yakuniy loyiha', issuer: 'Namuna Oʻquv Markazi', fakeIssuer: 'Namuna Oʻquv Markazi',
      hours: '144 soatlik kurs va yakuniy loyiha', s1: 'Kanonik shakl', s1d: function (n) { return n + ' bayt, kalitlar tartiblangan (JCS ga oʻxshash)'; },
      s2: 'SHA-256 xesh', s3: 'Imzo tekshiruvi', s3ok: 'imzo shu maʼlumotga mos', s3bad: 'imzo bu maʼlumotga mos emas',
      s4: 'Beruvchi ishonchli roʻyxatda', s4ok: 'did:web kaliti keshda, roʻyxatda bor', s4bad: 'bu DID ishonchli roʻyxatda yoʻq (oʻxshash nom)',
      s5: 'Bekor qilinmaganmi', s5ok: 'status roʻyxatida bit = 0', s5bad: 'status roʻyxatida bit = 1: bekor qilingan', skip: 'oʻtkazib yuborildi',
      vOk: 'Haqiqiy', vOkD: 'Imzo mos, beruvchi tanish, bekor qilinmagan.', vBad: 'Soxta', vBadD: 'Imzo mos emas: maʼlumot imzodan keyin oʻzgargan.',
      vFake: 'Soxta beruvchi', vFakeD: 'Imzo toʻgʻri, lekin uni boshqa kalit qoʻygan. Oʻxshash nom aldamaydi.', vRev: 'Bekor qilingan', vRevD: 'Imzo mos, lekin beruvchi bu sertifikatni bekor qilgan.',
      noCrypto: 'Brauzeringizda WebCrypto mavjud emas, demo ishlamaydi.', alg: function (a, ms) { return a + ' · tekshirish ' + ms + ' ms · internet ishlatilmadi'; } },
    en: { name: 'Sample Student', course: 'Python fundamentals', narrative: '72-hour course and a final project', issuer: 'Sample Training Centre', fakeIssuer: 'Sample Training Centre',
      hours: '144-hour course and a final project', s1: 'Canonical form', s1d: function (n) { return n + ' bytes, keys sorted (JCS-like)'; },
      s2: 'SHA-256 hash', s3: 'Signature check', s3ok: 'the signature matches this data', s3bad: 'the signature does not match this data',
      s4: 'Issuer is on the trust list', s4ok: 'did:web key is cached and trusted', s4bad: 'this DID is not on the trust list (lookalike name)',
      s5: 'Not revoked', s5ok: 'status list bit = 0', s5bad: 'status list bit = 1: revoked', skip: 'skipped',
      vOk: 'Genuine', vOkD: 'Signature matches, issuer is known, not revoked.', vBad: 'Forged', vBadD: 'Signature does not match: the data changed after signing.',
      vFake: 'Fake issuer', vFakeD: 'The signature is valid, but a different key made it. A lookalike name does not fool the check.', vRev: 'Revoked', vRevD: 'Signature matches, but the issuer has revoked this certificate.',
      noCrypto: 'WebCrypto is not available in this browser, so the demo cannot run.', alg: function (a, ms) { return a + ' · checked in ' + ms + ' ms · no network used'; } },
    ru: { name: 'Образец Ученик', course: 'Основы Python', narrative: 'Курс на 72 часа и итоговый проект', issuer: 'Образец Учебный Центр', fakeIssuer: 'Образец Учебный Центр',
      hours: 'Курс на 144 часа и итоговый проект', s1: 'Каноническая форма', s1d: function (n) { return n + ' байт, ключи отсортированы (как JCS)'; },
      s2: 'Хеш SHA-256', s3: 'Проверка подписи', s3ok: 'подпись соответствует данным', s3bad: 'подпись не соответствует данным',
      s4: 'Издатель в списке доверия', s4ok: 'ключ did:web в кэше и в списке', s4bad: 'этого DID нет в списке доверия (похожее имя)',
      s5: 'Не отозван', s5ok: 'бит в списке статусов = 0', s5bad: 'бит в списке статусов = 1: отозван', skip: 'пропущено',
      vOk: 'Подлинный', vOkD: 'Подпись верна, издатель известен, не отозван.', vBad: 'Подделка', vBadD: 'Подпись не совпадает: данные изменили после подписи.',
      vFake: 'Поддельный издатель', vFakeD: 'Подпись верна, но её поставил другой ключ. Похожее имя проверку не обманет.', vRev: 'Отозван', vRevD: 'Подпись верна, но издатель отозвал этот сертификат.',
      noCrypto: 'В этом браузере нет WebCrypto, демо не работает.', alg: function (a, ms) { return a + ' · проверено за ' + ms + ' мс · без сети'; } }
  }[lang] || null;
  if (!L) return;

  var $ = function (s) { return root.querySelector(s); };
  var out = $('#cred'), steps = $('#steps'), verdict = $('#verdict'), meta = $('#meta'), nameIn = $('#t-name-in');
  var tg = { name: $('#t-name'), hours: $('#t-hours'), issuer: $('#t-issuer'), rev: $('#t-rev') };

  if (!subtle) { verdict.querySelector('b').textContent = L.noCrypto; return; }

  var enc = new TextEncoder();
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    return JSON.stringify(v);
  }
  function b64u(buf) { var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var ALG = null, issuerKey, attackerKey;
  async function makeKeys() {
    try {
      ALG = { gen: { name: 'Ed25519' }, sign: { name: 'Ed25519' }, label: 'Ed25519' };
      issuerKey = await subtle.generateKey(ALG.gen, false, ['sign', 'verify']);
      attackerKey = await subtle.generateKey(ALG.gen, false, ['sign', 'verify']);
    } catch (e) {
      ALG = { gen: { name: 'ECDSA', namedCurve: 'P-256' }, sign: { name: 'ECDSA', hash: 'SHA-256' }, label: 'ECDSA P-256' };
      issuerKey = await subtle.generateKey(ALG.gen, false, ['sign', 'verify']);
      attackerKey = await subtle.generateKey(ALG.gen, false, ['sign', 'verify']);
    }
  }

  var ISS = 'did:web:markaz.example', FAKE = 'did:web:rnarkaz.example';
  // the verifier's offline cache: did:web documents fetched earlier + the issuer's trust list + a status list
  var resolver = {}, trusted = [ISS], statusBits = { 7: 0 };

  function base() {
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
  async function sign(doc, key, vm) {
    var d = clone(doc); delete d.proof;
    var h = await subtle.digest('SHA-256', enc.encode(canon(d)));
    var sig = await subtle.sign(ALG.sign, key.privateKey, h);
    d.proof = { type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022 (demo)', created: '2026-10-30T09:00:00Z', verificationMethod: vm + '#key-1', proofPurpose: 'assertionMethod', proofValue: 'u' + b64u(sig) };
    return d;
  }

  var original = null, issuedFake = null;
  async function init() {
    await makeKeys();
    resolver[ISS] = issuerKey.publicKey; resolver[FAKE] = attackerKey.publicKey;
    original = await sign(base(), issuerKey, ISS);
    var f = base(); f.issuer.id = FAKE; f.issuer.name = L.fakeIssuer;
    issuedFake = await sign(f, attackerKey, FAKE);
    nameIn.value = L.name;
    Object.keys(tg).forEach(function (k) { tg[k].addEventListener('change', run); });
    nameIn.addEventListener('input', function () { tg.name.checked = nameIn.value !== L.name; run(); });
    run();
  }

  function current() {
    var d = clone(tg.issuer.checked ? issuedFake : original);
    if (tg.name.checked) d.credentialSubject.name = nameIn.value !== L.name ? nameIn.value : (lang === 'ru' ? 'Другой Человек' : lang === 'en' ? 'Someone Else' : 'Boshqa Odam');
    if (tg.hours.checked) d.credentialSubject.achievement.criteria.narrative = L.hours;
    return d;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
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
  function li(title, detail, s) { return '<li data-s="' + s + '">' + ICO + '<div><b>' + esc(title) + '</b><span class="d">' + esc(detail) + '</span></div></li>'; }
  var ICON_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var ICON_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 12h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  var seq = 0;
  async function run() {
    var my = ++seq;
    statusBits[7] = tg.rev.checked ? 1 : 0;
    var d = current();
    out.innerHTML = render(d, original, 0);
    var t0 = performance.now();
    var body = clone(d); delete body.proof;
    var text = canon(body), bytes = enc.encode(text);
    var h = await subtle.digest('SHA-256', bytes);
    var vm = d.proof.verificationMethod.split('#')[0], key = resolver[vm], ok = false;
    try { ok = !!key && await subtle.verify(ALG.sign, key, unb64u(d.proof.proofValue.slice(1)), h); } catch (e) { ok = false; }
    var trust = trusted.indexOf(d.issuer.id) >= 0 && d.issuer.id === vm;
    var revoked = statusBits[parseInt(d.credentialStatus.statusListIndex, 10)] === 1;
    var ms = (performance.now() - t0).toFixed(1);
    if (my !== seq) return;
    var html = li(L.s1, L.s1d(bytes.length), 'ok') + li(L.s2, hex(h).slice(0, 32) + '…', 'ok') +
      li(L.s3, (ok ? L.s3ok : L.s3bad) + ' · ' + ALG.label + ' · ' + vm, ok ? 'ok' : 'bad');
    html += ok ? li(L.s4, (trust ? L.s4ok : L.s4bad) + ' · ' + d.issuer.id, trust ? 'ok' : 'bad') : li(L.s4, L.skip, 'skip');
    html += ok && trust ? li(L.s5, revoked ? L.s5bad : L.s5ok, revoked ? 'bad' : 'ok') : li(L.s5, L.skip, 'skip');
    steps.innerHTML = html;
    var v = !ok ? ['bad', L.vBad, L.vBadD, ICON_X] : !trust ? ['bad', L.vFake, L.vFakeD, ICON_X] : revoked ? ['rev', L.vRev, L.vRevD, ICON_R] : ['ok', L.vOk, L.vOkD, ICON_OK];
    verdict.setAttribute('data-v', v[0]);
    verdict.innerHTML = v[3] + '<div><b>' + esc(v[1]) + '</b><span>' + esc(v[2]) + '</span></div>';
    meta.textContent = L.alg(ALG.label, ms);
  }

  init().catch(function () { verdict.querySelector('b').textContent = L.noCrypto; });
})();
