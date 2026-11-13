/* Sanad in-browser demo. A real Ed25519 signature (WebCrypto) over a simplified Open Badges 3.0 style credential.
   Simplified on purpose: JSON keys are sorted (JCS-like), the SHA-256 of that text and of the proof options is signed,
   and the "did:web" lookup and the revocation list are local, cached objects. Keys are made fresh in your browser on
   every load and never leave it. The logic lives in sanad-core.js (loaded first); this file only wires the DOM. */
(function () {
  'use strict';
  var root = document.getElementById('demo');
  var C = window.SanadCore;
  if (!root || !C) return;
  var L = C.strings((document.documentElement.lang || 'uz').slice(0, 2));
  if (!L) return;
  var subtle = window.crypto && window.crypto.subtle;

  var $ = function (s) { return root.querySelector(s); };
  var out = $('#cred'), steps = $('#steps'), verdict = $('#verdict'), meta = $('#meta'), nameIn = $('#t-name-in');
  var tg = { name: $('#t-name'), hours: $('#t-hours'), issuer: $('#t-issuer'), rev: $('#t-rev') };

  if (!subtle) { verdict.querySelector('b').textContent = L.noCrypto; return; }

  // the verifier's offline cache: did:web documents fetched earlier + the issuer's trust list + a status list
  var ctx = { resolver: {}, trusted: [C.ISS], statusBits: { 7: 0 } };
  var keys = null, original = null, issuedFake = null;

  async function init() {
    keys = await C.makeKeys(subtle);
    ctx.resolver[C.ISS] = keys.issuer.publicKey; ctx.resolver[C.FAKE] = keys.attacker.publicKey;
    original = await C.sign(subtle, keys.alg, keys.issuer, C.base(L), C.ISS);
    var f = C.base(L); f.issuer.id = C.FAKE; f.issuer.name = L.fakeIssuer;
    issuedFake = await C.sign(subtle, keys.alg, keys.attacker, f, C.FAKE);
    nameIn.value = L.name;
    Object.keys(tg).forEach(function (k) { tg[k].addEventListener('change', run); });
    nameIn.addEventListener('input', function () { tg.name.checked = nameIn.value !== L.name; run(); });
    run();
  }

  var seq = 0;
  async function run() {
    var my = ++seq;
    ctx.statusBits[7] = tg.rev.checked ? 1 : 0;
    var d = C.tamper(tg.issuer.checked ? issuedFake : original, { name: tg.name.checked, nameValue: nameIn.value, hours: tg.hours.checked }, L);
    out.innerHTML = C.render(d, original, 0);
    var t0 = performance.now();
    var r = await C.verify(subtle, keys.alg, d, ctx);
    var ms = (performance.now() - t0).toFixed(1);
    if (my !== seq) return;
    steps.innerHTML = C.stepsHtml(L, r, keys.alg.label);
    var v = C.verdictView(L, r.verdict);
    verdict.setAttribute('data-v', v.state);
    verdict.innerHTML = v.html;
    meta.textContent = L.alg(keys.alg.label, ms);
  }

  init().catch(function () { verdict.querySelector('b').textContent = L.noCrypto; });
})();
