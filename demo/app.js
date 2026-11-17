// SPDX-FileCopyrightText: 2026 Wonmor and Sanad contributors
// SPDX-License-Identifier: Apache-2.0

/* Sanad concept demo: the planned issuer console, offline verifier, holder view and Telegram bot, running in the
   browser on fictional data. Hash routing, so any static host and sub-path work. What is real: every credential is
   signed at load time with a fresh Ed25519 key (WebCrypto, ECDSA P-256 where Ed25519 is missing) and every check
   re-verifies the signature over the canonical JSON (site/assets/js/sanad-core.js). What is simulated: did:web
   resolution (a local cache), the status list server, PDF/QR rendering and the bot. */
import { seed, ISSUER, TRUSTED, LOOKALIKES, ACHIEVEMENTS, DAY, rng } from './data.js';

const C = globalThis.SanadCore;
const subtle = globalThis.crypto && globalThis.crypto.subtle;
const NOW = Date.now();
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const NF = new Intl.NumberFormat('en-US');
const STATUS_URL = 'https://' + ISSUER.domain + '/status/1';

/* ---------- DOM helpers ---------- */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : String(k));
  return el;
}
const SVGNS = 'http://www.w3.org/2000/svg';
function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  for (const k of kids) if (k != null) el.append(k.nodeType ? k : document.createTextNode(String(k)));
  return el;
}
const num = (n) => NF.format(n).replace(/,/g, ' ');
const pad = (n) => String(n).padStart(2, '0');
const fmtDay = (t) => { const d = new Date(t); return `${d.getDate()}-${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const fmtShort = (t) => { const d = new Date(t); return `${d.getDate()}-${MONTHS[d.getMonth()].slice(0, 3)}`; };
const fmtTime = (t) => { const d = new Date(t); return `${fmtDay(t)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const iso = (t) => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
function ago(t) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60e3));
  if (m < 1) return 'hozirgina';
  if (m < 60) return m + ' daqiqa oldin';
  const hr = Math.round(m / 60);
  if (hr < 48) return hr + ' soat oldin';
  const d = Math.round(hr / 24);
  return d < 60 ? d + ' kun oldin' : Math.round(d / 30) + ' oy oldin';
}
const go = (path) => { location.hash = '#' + path; };
const link = (path, ...kids) => h('a', { href: '#' + path }, ...kids);
let toastTimer = 0;
function toast(text) {
  let el = document.getElementById('toast');
  if (!el) { el = h('div', { id: 'toast', role: 'status', class: 'toast' }); document.body.append(el); }
  el.textContent = text; el.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
}
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(name + ' yuklab olindi');
}
const achById = (id) => ACHIEVEMENTS.find((a) => a.id === id);

/* ---------- world: keys, signed credentials, status list ---------- */
const world = seed(NOW);
const creds = world.creds;
const ach = ACHIEVEMENTS.map((a) => ({ ...a }));
const keys = {};          // verificationMethod -> CryptoKeyPair (the issuer's DID document, cached by verifiers)
const keyInfo = [];       // for the keys page
const statusBits = {};    // statusListIndex -> 0 | 1
let ALG = null;
const samples = {};

async function genKey() {
  try { const k = await subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']); ALG = ALG || { sign: { name: 'Ed25519' }, label: 'Ed25519' }; return k; } catch {
    ALG = { sign: { name: 'ECDSA', hash: 'SHA-256' }, label: 'ECDSA P-256' };
    return subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  }
}
function credDoc(c) {
  const a = achById(c.ach);
  const doc = {
    '@context': ['https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'],
    id: 'urn:uuid:' + c.id + '-' + (c.statusIndex * 7919).toString(16) + '-demo',
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    issuer: { id: c.issuerId || ISSUER.id, type: ['Profile'], name: c.issuerName || ISSUER.name },
    validFrom: iso(c.issued),
    name: a.name,
    credentialSubject: {
      type: ['AchievementSubject'], name: c.holder,
      achievement: { id: 'urn:sanad:' + ISSUER.domain + ':' + a.id, type: ['Achievement'], achievementType: a.kind === 'Badge' ? 'Badge' : 'Certificate', name: a.name, criteria: { narrative: a.narrative } },
    },
    credentialStatus: { type: 'BitstringStatusListEntry', statusPurpose: 'revocation', statusListIndex: String(c.statusIndex), statusListCredential: STATUS_URL },
  };
  if (c.grade) doc.credentialSubject.result = { type: ['Result'], value: c.grade };
  if (c.validUntil) doc.validUntil = iso(c.validUntil);
  return doc;
}
async function signDoc(doc, vm, created) {
  const d = C.clone(doc);
  d.proof = { type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022 (demo)', created: iso(created), verificationMethod: vm, proofPurpose: 'assertionMethod' };
  const hd = await C.hashData(subtle, d);
  d.proof.proofValue = 'u' + C.b64u(await subtle.sign(ALG.sign, keys[vm].privateKey, hd.input));
  return d;
}

async function buildWorld() {
  keys[ISSUER.id + '#key-0'] = await genKey();
  keys[ISSUER.id + '#key-1'] = await genKey();
  keys[LOOKALIKES[0].id + '#key-1'] = await genKey();
  keys['did:web:raqamliavlod.example#key-1'] = await genKey();
  keyInfo.push({ vm: ISSUER.id + '#key-0', state: 'retired', from: NOW - 360 * DAY, to: NOW - 150 * DAY, where: 'OpenBao (eski)' },
    { vm: ISSUER.id + '#key-1', state: 'active', from: NOW - 150 * DAY, to: null, where: 'OpenBao, transit engine' });
  await Promise.all(creds.map(async (c) => {
    c.doc = await signDoc(credDoc(c), ISSUER.id + '#' + c.key, c.issued);
    statusBits[c.statusIndex] = c.state === 'revoked' ? 1 : 0;
  }));
  // verifier samples: forged edits of a real credential, a lookalike issuer, an unknown issuer, a bare QR
  const real = creds.find((c) => c.state === 'active' && c.ach === 'python' && !c.validUntil);
  samples.good = real;
  const fake = { ...real, issuerId: LOOKALIKES[0].id, issuerName: LOOKALIKES[0].name, statusIndex: 77 };
  samples.lookalike = await signDoc(credDoc(fake), LOOKALIKES[0].id + '#key-1', real.issued);
  const other = { ...real, issuerId: 'did:web:raqamliavlod.example', issuerName: 'Raqamli Avlod IT akademiyasi', ach: 'react', statusIndex: 12 };
  samples.otherTrusted = await signDoc(credDoc(other), 'did:web:raqamliavlod.example#key-1', real.issued - 40 * DAY);
  statusBits[12] = 0;
}

/* ---------- verification (offline: DID cache + trust list; online only for the status list) ---------- */
async function verifyDoc(doc, opts = {}) {
  const t0 = performance.now();
  const steps = [];
  const fail = (title, detail, verdict, text) => ({ steps: [...steps, [title, detail, 'bad']], verdict: ['bad', verdict, text], ms: (performance.now() - t0).toFixed(1) });
  if (!doc || typeof doc !== 'object') return fail('Format', 'JSON oʻqilmadi', 'Oʻqib boʻlmadi', 'Bu W3C Verifiable Credential emas.');
  const ctx = Array.isArray(doc['@context']) && doc['@context'][0] === 'https://www.w3.org/ns/credentials/v2';
  if (!ctx || !Array.isArray(doc.type) || !doc.type.includes('VerifiableCredential') || !doc.proof) return fail('Format', 'VC 2.0 konteksti, turi yoki imzosi yoʻq', 'Imzo yoʻq', 'Bu hujjatda tekshiriladigan imzo yoʻq.');
  steps.push(['Format', 'W3C VC 2.0 · ' + doc.type.filter((t) => t !== 'VerifiableCredential').join(', '), 'ok']);
  let hd;
  try { hd = await C.hashData(subtle, doc); } catch { return fail('Kanonik shakl', 'JSON kanonik shaklga keltirilmadi', 'Buzilgan', 'Hujjat tuzilmasi notoʻgʻri.'); }
  steps.push(['Kanonik shakl va SHA-256', hd.bytes + ' bayt · ' + C.hex(hd.docHash).slice(0, 24) + '…', 'ok']);
  const proof = doc.proof, vm = typeof proof.verificationMethod === 'string' ? proof.verificationMethod : '';
  const key = keys[vm];
  let sigOk = false;
  if (key && proof.type === 'DataIntegrityProof' && proof.proofPurpose === 'assertionMethod' && typeof proof.proofValue === 'string' && proof.proofValue[0] === 'u') {
    try { sigOk = (await subtle.verify(ALG.sign, key.publicKey, C.unb64u(proof.proofValue.slice(1)), hd.input)) === true; } catch { sigOk = false; }
  }
  steps.push(['Imzo (' + ALG.label + ')', key ? (sigOk ? 'imzo shu maʼlumotga mos · ' + vm : 'imzo mos emas: maʼlumot imzodan keyin oʻzgargan') : 'bu kalit keshda yoʻq: ' + (vm || '—'), sigOk ? 'ok' : 'bad']);
  const issuerId = doc.issuer && typeof doc.issuer.id === 'string' ? doc.issuer.id : '';
  const trusted = TRUSTED.some((t) => t.id === issuerId) && vm.split('#')[0] === issuerId;
  const look = LOOKALIKES.find((l) => l.id === issuerId);
  if (sigOk) steps.push(['Beruvchi ishonchli roʻyxatda', trusted ? issuerId + ' · ' + (TRUSTED.find((t) => t.id === issuerId).name) : look ? issuerId + ' roʻyxatda yoʻq: ' + look.why : issuerId + ' roʻyxatda yoʻq', trusted ? 'ok' : 'bad']);
  else steps.push(['Beruvchi ishonchli roʻyxatda', 'oʻtkazib yuborildi', 'skip']);
  const now = Date.now();
  const from = Date.parse(doc.validFrom), until = doc.validUntil ? Date.parse(doc.validUntil) : null;
  const timeOk = !(from > now) && !(until && until < now);
  if (sigOk && trusted) steps.push(['Amal qilish muddati', until ? (timeOk ? fmtDay(until) + ' gacha' : fmtDay(until) + ' da tugagan') : 'muddatsiz · ' + fmtDay(from) + ' dan', timeOk ? 'ok' : 'bad']);
  else steps.push(['Amal qilish muddati', 'oʻtkazib yuborildi', 'skip']);
  let revoked = false;
  if (sigOk && trusted && timeOk) {
    if (opts.offline) steps.push(['Bekor qilinmaganmi', 'oflayn: status roʻyxati yuklanmadi, tekshirilmadi', 'skip']);
    else {
      const i = doc.credentialStatus && doc.credentialStatus.statusListIndex;
      revoked = issuerId === ISSUER.id || issuerId === 'did:web:raqamliavlod.example' ? C.isRevoked(statusBits, doc.credentialStatus) : false;
      steps.push(['Bekor qilinmaganmi', revoked ? 'status roʻyxatida bit #' + i + ' = 1: bekor qilingan' : 'status roʻyxatida bit #' + i + ' = 0', revoked ? 'bad' : 'ok']);
    }
  } else steps.push(['Bekor qilinmaganmi', 'oʻtkazib yuborildi', 'skip']);
  const ms = (performance.now() - t0).toFixed(1);
  let verdict;
  if (!sigOk) verdict = ['bad', key ? 'Soxta' : 'Notanish kalit', key ? 'Imzo mos emas: sertifikatdagi maʼlumot imzolangandan keyin oʻzgartirilgan.' : 'Bu kalitni tekshiruvchi bilmaydi. Beruvchining did:web hujjati keshda yoʻq.'];
  else if (!trusted) verdict = ['bad', 'Soxta beruvchi', 'Imzo toʻgʻri, lekin uni ishonchli roʻyxatda yoʻq kalit qoʻygan. Oʻxshash nom aldamaydi.'];
  else if (!timeOk) verdict = ['rev', 'Muddati tugagan', 'Imzo haqiqiy, lekin sertifikatning amal qilish muddati oʻtgan.'];
  else if (revoked) verdict = ['rev', 'Bekor qilingan', 'Imzo haqiqiy, lekin beruvchi bu sertifikatni bekor qilgan.'];
  else verdict = ['ok', 'Haqiqiy', opts.offline ? 'Imzo mos, beruvchi tanish. Bekor qilish holati oflayn tekshirilmadi.' : 'Imzo mos, beruvchi tanish, muddati amalda, bekor qilinmagan.'];
  return { steps, verdict, ms, issuerId, holder: doc.credentialSubject && doc.credentialSubject.name };
}

/* ---------- labels ---------- */
const badge = (kind, text, title) => h('span', { class: 'badge b-' + kind, title }, text);
function credState(c) {
  if (c.state === 'revoked') return 'revoked';
  if (c.validUntil && c.validUntil < Date.now()) return 'expired';
  return 'active';
}
const STATE = { active: ['ok', 'Amalda'], revoked: ['bad', 'Bekor qilingan'], expired: ['warn', 'Muddati tugagan'] };
const stateBadge = (c) => { const [k, t] = STATE[credState(c)]; return badge(k, t); };

/* ---------- layout ---------- */
const NAV = [
  ['/', 'Kabinet', 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'],
  ['/credentials', 'Sertifikatlar', 'M5 4h14v12H5zM9 20l3-2 3 2v-4H9zM8 8h8M8 11h5'],
  ['/issue', 'Chiqarish', 'M12 5v14M5 12h14'],
  ['/achievements', 'Kurslar va badgeʼlar', 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z'],
  ['/verify', 'Tekshirish', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5'],
  ['/trust', 'Kalitlar va ishonch', 'M8 14a4 4 0 1 1 3.5-6H21v3h-2v3h-3v-3h-4.5A4 4 0 0 1 8 14z'],
  ['/holder', 'Bitiruvchi koʻrinishi', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0'],
  ['/bot', 'Telegram bot', 'M21 4L3 11l6 2 2 6 3-4 5 4z'],
  ['/about', 'Konsept haqida', 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v6M12 7.5v.5'],
];
const icon = (d) => s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'ic' }, s('path', { d }));
const mark = () => s('svg', { viewBox: '0 0 32 32', class: 'mark', 'aria-hidden': 'true' },
  s('circle', { cx: 16, cy: 16, r: 14, class: 'm1' }), s('circle', { cx: 16, cy: 16, r: 10, class: 'm2' }), s('circle', { cx: 16, cy: 16, r: 6.5, class: 'm2' }), s('path', { d: 'M12.5 16.5l2.4 2.3 4.6-5', class: 'm3' }));
function themeToggle() {
  const b = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mavzuni almashtirish', title: 'Mavzuni almashtirish' }, icon('M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z'));
  b.addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('sanad-demo-theme', root.dataset.theme); } catch { /* private mode */ }
  });
  return b;
}
try { const t = localStorage.getItem('sanad-demo-theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch { /* private mode */ }

function shell(path, content) {
  const cur = '/' + (path.split('/')[1] || '');
  document.getElementById('app').replaceChildren(
    h('header', { class: 'top' },
      h('a', { class: 'brand', href: '#/' }, mark(), 'Sanad'),
      h('span', { class: 'concept', title: 'Mahsulot hali chiqmagan: bu rejalashtirilgan interfeys' }, 'Konsept demo'),
      h('span', { class: 'org' }, h('b', null, ISSUER.name), h('span', { class: 'sub' }, 'demo / demo · beruvchi')),
      h('a', { class: 'top-link', href: 'https://sanad.wonmor.io/' }, 'Bosh sahifa'),
      themeToggle()),
    h('nav', { class: 'nav', 'aria-label': 'Boʻlimlar' }, NAV.map(([p, t, d]) => h('a', { href: '#' + p, class: p === cur ? 'on' : null, 'aria-current': p === cur ? 'page' : null }, icon(d), h('span', null, t)))),
    h('main', { id: 'main' }, content),
    h('div', { class: 'demo-pill', role: 'note' }, h('i'), 'Demo · namuna maʼlumotlar, qayta yuklanganda tiklanadi'));
  window.scrollTo(0, 0);
}
const pageHead = (title, sub, ...actions) => h('div', { class: 'page-head' }, h('div', null, h('h1', null, title), sub ? h('p', { class: 'sub' }, sub) : null), actions.filter(Boolean).length ? h('div', { class: 'actions' }, actions) : null);
const card = (title, ...kids) => h('section', { class: 'card' }, title ? h('h2', null, title) : null, kids);
const kpi = (label, value, foot, kind) => h('div', { class: 'kpi' + (kind ? ' k-' + kind : '') }, h('span', { class: 'kl' }, label), h('b', null, value), foot ? h('span', { class: 'kf' }, foot) : null);
const btn = (text, onclick, kind = '', attrs = {}) => h('button', { type: 'button', class: 'btn ' + kind, onclick, ...attrs }, text);
const dl = (rows) => h('dl', { class: 'kv' }, rows.filter(Boolean).map(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
const jsonView = (doc, ref) => { const pre = h('pre', { class: 'code json' }); pre.innerHTML = C.render(doc, ref, 0); return pre; };

/* ---------- certificate (the printable paper) ---------- */
function pseudoQr(seedText) {
  const r = rng([...seedText].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7));
  const n = 25, svg = s('svg', { viewBox: `0 0 ${n} ${n}`, class: 'qr', role: 'img', 'aria-label': 'QR namunasi (demo, skanerlanmaydi)' });
  svg.append(s('rect', { x: 0, y: 0, width: n, height: n, class: 'qr-bg' }));
  const finder = (x, y) => { svg.append(s('rect', { x, y, width: 7, height: 7, class: 'qr-f' }), s('rect', { x: x + 1, y: y + 1, width: 5, height: 5, class: 'qr-bg' }), s('rect', { x: x + 2, y: y + 2, width: 3, height: 3, class: 'qr-f' })); };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if ((x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9)) continue;
    if (r() < 0.47) svg.append(s('rect', { x, y, width: 1, height: 1, class: 'qr-f' }));
  }
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
  return svg;
}
function certificate(c, opts = {}) {
  const a = achById(c.ach), st = credState(c);
  return h('article', { class: 'cert' + (st !== 'active' ? ' cert-' + st : '') + (opts.small ? ' small' : '') },
    h('div', { class: 'cert-in' },
      h('div', { class: 'cert-top' }, h('span', { class: 'cert-org' }, ISSUER.name), h('span', { class: 'cert-kind' }, a.kind === 'Badge' ? 'Badge' : 'Sertifikat')),
      h('p', { class: 'cert-lbl' }, 'Ushbu hujjat bilan tasdiqlanadiki'),
      h('p', { class: 'cert-name' }, c.holder),
      h('p', { class: 'cert-lbl' }, a.kind === 'Badge' ? 'quyidagi yutuqqa erishdi' : 'quyidagi kursni muvaffaqiyatli tamomladi'),
      h('p', { class: 'cert-course' }, a.name),
      h('p', { class: 'cert-desc' }, a.narrative + (c.grade ? ' · baho: ' + c.grade : '')),
      h('div', { class: 'cert-foot' },
        h('div', null, h('span', { class: 'cert-lbl' }, 'Sana'), h('b', null, fmtDay(c.issued)), c.validUntil ? h('span', { class: 'cert-lbl' }, fmtDay(c.validUntil) + ' gacha') : null),
        h('div', { class: 'seal' }, mark(), h('span', null, 'imzolangan')),
        h('div', { class: 'cert-qr' }, pseudoQr(c.id), h('span', { class: 'cert-lbl' }, c.id.toUpperCase()))),
      st !== 'active' ? h('div', { class: 'stamp' }, STATE[st][1]) : null));
}

/* ---------- charts ---------- */
function issuedChart() {
  const months = [];
  const d = new Date(NOW); d.setDate(1); d.setHours(0, 0, 0, 0);
  for (let i = 11; i >= 0; i--) { const m = new Date(d); m.setMonth(d.getMonth() - i); months.push({ t: m.getTime(), cert: 0, badge: 0 }); }
  for (const c of creds) {
    const i = months.findLastIndex((m) => m.t <= c.issued);
    if (i >= 0) achById(c.ach).kind === 'Badge' ? months[i].badge++ : months[i].cert++;
  }
  const W = 720, H = 220, L = 28, B = 26, top = 10, max = Math.max(5, ...months.map((m) => m.cert + m.badge));
  const ymax = Math.ceil(max / 5) * 5, bw = (W - L - 4) / months.length;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Oyma-oy chiqarilgan sertifikat va badgeʼlar' });
  for (let i = 0; i <= 5; i++) { const y = top + (H - top - B) * (1 - i / 5); svg.append(s('line', { x1: L, x2: W, y1: y, y2: y, class: 'grid' }), s('text', { x: L - 6, y: y + 4, class: 'axis', 'text-anchor': 'end' }, String(ymax * i / 5))); }
  months.forEach((m, i) => {
    const x = L + i * bw + 6, w = bw - 12, hc = (H - top - B) * m.cert / ymax, hb = (H - top - B) * m.badge / ymax;
    const g = s('g', { class: 'bar' });
    g.append(s('rect', { x, y: H - B - hc, width: w, height: Math.max(0, hc), rx: 3, class: 'c-cert' }), s('rect', { x, y: H - B - hc - hb, width: w, height: Math.max(0, hb), rx: 3, class: 'c-badge' }));
    g.append(s('title', {}, `${MONTHS[new Date(m.t).getMonth()]}: ${m.cert} sertifikat, ${m.badge} badge`));
    svg.append(g, s('text', { x: x + w / 2, y: H - 8, class: 'axis', 'text-anchor': 'middle' }, MONTHS[new Date(m.t).getMonth()].slice(0, 3)));
  });
  return h('figure', { class: 'chart-wrap' }, svg, h('figcaption', { class: 'legend' }, h('span', null, h('i', { class: 'sw c-cert' }), 'Sertifikat'), h('span', null, h('i', { class: 'sw c-badge' }), 'Badge')));
}
function checksChart() {
  const W = 720, H = 200, L = 30, B = 24, top = 8, rows = world.checks;
  const keysOrder = [['ok', 'Haqiqiy'], ['rev', 'Bekor / muddati oʻtgan'], ['bad', 'Soxta'], ['fake', 'Soxta beruvchi'], ['qr', 'Imzosiz QR']];
  const max = Math.max(...rows.map((r) => r.ok + r.bad + r.fake + r.rev + r.qr)), ymax = Math.ceil(max / 40) * 40, bw = (W - L - 4) / rows.length;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Sanad bot orqali kunlik tekshiruvlar, natija boʻyicha' });
  for (let i = 0; i <= 4; i++) { const y = top + (H - top - B) * (1 - i / 4); svg.append(s('line', { x1: L, x2: W, y1: y, y2: y, class: 'grid' }), s('text', { x: L - 6, y: y + 4, class: 'axis', 'text-anchor': 'end' }, String(ymax * i / 4))); }
  rows.forEach((r, i) => {
    let y = H - B;
    const x = L + i * bw + 2, w = bw - 4, g = s('g', { class: 'bar' });
    for (const [k] of keysOrder) { const hh = (H - top - B) * r[k] / ymax; if (hh <= 0) continue; y -= hh; g.append(s('rect', { x, y, width: w, height: hh, class: 'ch-' + k })); }
    g.append(s('title', {}, `${fmtShort(r.day)}: ${keysOrder.map(([k, t]) => t + ' ' + r[k]).join(', ')}`));
    svg.append(g);
    if (i % 5 === 0 || i === rows.length - 1) svg.append(s('text', { x: x + w / 2, y: H - 6, class: 'axis', 'text-anchor': 'middle' }, i === rows.length - 1 ? 'bugun' : fmtShort(r.day)));
  });
  return h('figure', { class: 'chart-wrap' }, svg, h('figcaption', { class: 'legend' }, keysOrder.map(([k, t]) => h('span', null, h('i', { class: 'sw ch-' + k }), t))));
}

/* ---------- pages ---------- */
function credRow(c) {
  const a = achById(c.ach);
  return h('tr', { class: 'click', tabindex: '0', onclick: () => go('/credentials/' + c.id), onkeydown: (e) => { if (e.key === 'Enter') go('/credentials/' + c.id); } },
    h('td', null, h('div', { class: 'who' }, h('span', { class: 'ava' }, c.holder.split(' ').map((p) => p[0]).join('')), h('div', null, h('b', null, c.holder), h('span', { class: 'sub mono' }, c.id.toUpperCase())))),
    h('td', null, a.name, h('span', { class: 'sub' }, a.kind === 'Badge' ? ' · badge' : ' · ' + a.hours + ' soat')),
    h('td', { class: 'hide-sm sub nowrap' }, fmtDay(c.issued)),
    h('td', { class: 'hide-sm mono' }, c.key),
    h('td', null, stateBadge(c)));
}
function credTable(list) {
  return h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
    h('thead', null, h('tr', null, h('th', null, 'Bitiruvchi'), h('th', null, 'Kurs'), h('th', { class: 'hide-sm' }, 'Berilgan'), h('th', { class: 'hide-sm' }, 'Kalit'), h('th', null, 'Holat'))),
    h('tbody', null, list.map(credRow))));
}

function dashboard() {
  const active = creds.filter((c) => credState(c) === 'active').length;
  const revoked = creds.filter((c) => c.state === 'revoked').length;
  const expired = creds.filter((c) => credState(c) === 'expired').length;
  const month = creds.filter((c) => c.issued > NOW - 30 * DAY).length;
  const tot = world.checks.reduce((a, r) => a + r.ok + r.bad + r.fake + r.rev + r.qr, 0);
  const caught = world.checks.reduce((a, r) => a + r.bad + r.fake + r.qr, 0);
  return [
    pageHead('Kabinet', `${ISSUER.name} · ${ISSUER.id} · ${ISSUER.city}`, btn('Sertifikat chiqarish', () => go('/issue'), 'primary'), btn('Tekshirish', () => go('/verify'))),
    h('div', { class: 'kpis' },
      kpi('Chiqarilgan', num(creds.length), '+' + month + ' shu oyda · 12 oyda'),
      kpi('Amalda', num(active), Math.round(100 * active / creds.length) + '% · imzo kaliti key-1', 'ok'),
      kpi('Bekor qilingan / tugagan', revoked + ' / ' + expired, 'status roʻyxati: 1 ta bitstring', 'warn'),
      kpi('Bot tekshiruvlari, 30 kun', num(tot), num(caught) + ' tasi soxta yoki imzosiz', 'bad')),
    h('div', { class: 'grid-2' },
      card('Chiqarilgan sertifikatlar', h('p', { class: 'sub' }, 'Oyma-oy, 12 oy. Har biri Ed25519 bilan imzolangan VC 2.0 / Open Badges 3.0.'), issuedChart()),
      h('div', { class: 'stack' },
        card('Imzo kaliti', dl([['Faol', h('code', null, ISSUER.id + '#key-1')], ['Algoritm', (ALG ? ALG.label : '') + ' · eddsa-jcs-2022'], ['Saqlanadi', 'OpenBao (konsept)'], ['Oldingi', h('span', null, h('code', null, '#key-0'), ' · nafaqada, eski sertifikatlar tekshiriladi')]]),
          h('div', { class: 'row-actions' }, link('/trust', 'Kalitlar va ishonch roʻyxati'))),
        card('Soxta urinishlar', h('ul', { class: 'mini' },
          h('li', null, h('b', null, LOOKALIKES[0].seen + ' ta'), ' oʻxshash domen ', h('code', null, LOOKALIKES[0].id), ' bilan'),
          h('li', null, h('b', null, num(world.checks.reduce((a, r) => a + r.qr, 0)) + ' ta'), ' imzosiz QR (faqat havola)'),
          h('li', null, h('b', null, num(world.checks.reduce((a, r) => a + r.bad, 0)) + ' ta'), ' maʼlumoti oʻzgartirilgan nusxa')), h('p', { class: 'sub' }, 'Bot statistikasi anonim: kim nimani tekshirganini bilmaymiz.')))),
    card('Telegram bot orqali tekshiruvlar', h('p', { class: 'sub' }, 'Soʻnggi 30 kun, natija boʻyicha. Oflayn tekshiruvlar bu yerda koʻrinmaydi: ular hech qayerga xabar bermaydi, bu ataylab.'), checksChart()),
    card('Soʻnggi chiqarilganlar', credTable(creds.slice(0, 8)), h('div', { class: 'row-actions' }, link('/credentials', 'Hammasi (' + creds.length + ')'))),
  ];
}

const listState = { q: '', filter: 'all', ach: 'all', page: 0 };
function credentialsPage() {
  const out = h('div', { class: 'stack' });
  const search = h('input', { type: 'search', id: 'cr-search', placeholder: 'Ism yoki ID boʻyicha…', 'aria-label': 'Qidirish', value: listState.q });
  const achSel = h('select', { id: 'cr-ach', 'aria-label': 'Kurs' }, h('option', { value: 'all' }, 'Barcha kurslar'), ach.map((a) => h('option', { value: a.id }, a.name)));
  achSel.value = listState.ach;
  const body = h('div');
  function draw() {
    const q = listState.q.trim().toLowerCase();
    const counts = { all: creds.length, active: 0, revoked: 0, expired: 0 };
    for (const c of creds) counts[credState(c)]++;
    const list = creds.filter((c) => (listState.filter === 'all' || credState(c) === listState.filter) && (listState.ach === 'all' || c.ach === listState.ach) &&
      (!q || c.holder.toLowerCase().includes(q) || c.id.includes(q)));
    const pages = Math.max(1, Math.ceil(list.length / 25));
    listState.page = Math.min(listState.page, pages - 1);
    const shown = list.slice(listState.page * 25, listState.page * 25 + 25);
    body.replaceChildren(
      h('div', { class: 'chips' }, [['all', 'Hammasi'], ['active', 'Amalda'], ['revoked', 'Bekor qilingan'], ['expired', 'Muddati tugagan']].map(([k, t]) =>
        h('button', { type: 'button', class: 'fchip' + (listState.filter === k ? ' on' : ''), 'aria-pressed': String(listState.filter === k), onclick: () => { listState.filter = k; listState.page = 0; draw(); } }, t, h('span', null, String(counts[k]))))),
      list.length ? credTable(shown) : h('div', { class: 'empty' }, h('b', null, 'Hech narsa topilmadi'), h('p', { class: 'sub' }, 'Bu filtrda sertifikat yoʻq.'),
        btn('Filtrni tozalash', () => { Object.assign(listState, { q: '', filter: 'all', ach: 'all', page: 0 }); search.value = ''; achSel.value = 'all'; draw(); })),
      list.length > 25 ? h('div', { class: 'pager' }, btn('Oldingi', () => { listState.page--; draw(); }, '', { disabled: listState.page === 0 }),
        h('span', { class: 'sub' }, `${listState.page * 25 + 1}–${listState.page * 25 + shown.length} / ${list.length}`),
        btn('Keyingi', () => { listState.page++; draw(); }, '', { disabled: listState.page >= pages - 1, id: 'cr-next' })) : null);
  }
  search.addEventListener('input', () => { listState.q = search.value; listState.page = 0; draw(); });
  achSel.addEventListener('change', () => { listState.ach = achSel.value; listState.page = 0; draw(); });
  out.append(pageHead('Sertifikatlar', creds.length + ' ta imzolangan hujjat · sertifikat bitiruvchida, bu yerda faqat nusxa va holat', btn('Chiqarish', () => go('/issue'), 'primary'),
    btn('Roʻyxatni eksport (CSV)', () => { const rows = ['id,holder,course,issued,status', ...creds.map((c) => [c.id, c.holder, achById(c.ach).name, iso(c.issued).slice(0, 10), credState(c)].join(','))]; download('sertifikatlar.csv', rows.join('\n')); })),
  h('div', { class: 'toolbar' }, search, achSel), body);
  draw();
  return out;
}

function credentialDetail(id) {
  const c = creds.find((x) => x.id === id);
  if (!c) return notFound('Bunday sertifikat topilmadi', 'ID notoʻgʻri yoki sertifikat shu sessiyada yaratilmagan.');
  const st = credState(c), a = achById(c.ach);
  const result = h('div', { class: 'stack', 'aria-live': 'polite' });
  const reason = h('select', { id: 'rv-reason', 'aria-label': 'Sabab' }, ['Ism xato yozilgan', 'Kurs toʻlovi qaytarildi', 'Koʻchirmachilik aniqlandi', 'Bitiruvchining iltimosi bilan'].map((t) => h('option', null, t)));
  const dlg = h('dialog', { class: 'dialog', id: 'rv-dialog' },
    h('h2', null, 'Sertifikat bekor qilinsinmi?'),
    h('p', null, c.holder + ' · ' + a.name + '. Status roʻyxatidagi #' + c.statusIndex + ' bit 1 ga oʻzgaradi; onlayn tekshiruv endi «bekor qilingan» deydi.'),
    h('label', { class: 'field col' }, h('span', null, 'Sabab (faqat kabinetda koʻrinadi)'), reason),
    h('p', { class: 'note warn' }, 'Oflayn tekshiruvchi status roʻyxatini yangilamaguncha sertifikatni «haqiqiy» deb koʻrishi mumkin. Shuning uchun tekshiruvchi oflayn natijada «bekor qilish tekshirilmadi» deb yozadi.'),
    h('div', { class: 'row-actions' }, btn('Bekor', () => dlg.close()), btn('Bekor qilish', () => { c.state = 'revoked'; c.revokedAt = Date.now(); c.reason = reason.value; statusBits[c.statusIndex] = 1; dlg.close(); toast('Bekor qilindi: status bit #' + c.statusIndex + ' = 1'); route(); }, 'danger', { id: 'rv-confirm' })));
  async function check(offline) {
    const r = await verifyDoc(c.doc, { offline });
    result.replaceChildren(verdictBox(r), ...stepsList(r));
  }
  queueMicrotask(() => check(false));
  return [
    pageHead(c.holder, `${a.name} · ${c.id.toUpperCase()} · ${fmtDay(c.issued)}`,
      btn('Chop etish / PDF', () => window.print(), 'primary'),
      btn('VC faylini yuklab olish', () => download(c.id + '.vc.json', JSON.stringify(c.doc, null, 2))),
      st === 'active' ? btn('Bekor qilish', () => dlg.showModal(), 'ghost danger-text', { id: 'cr-revoke' }) : null),
    h('div', { class: 'grid-2' },
      h('div', { class: 'stack' }, h('div', { class: 'print-area' }, certificate(c)),
        h('p', { class: 'sub' }, 'QR namunasi skanerlanmaydi (demo). Haqiqiy PDF ichida QR imzolangan VC ning oʻzini olib yuradi; sigʻmasa VC fayli PDF ga biriktiriladi.'),
        card('Imzolangan VC (JSON)', jsonView(c.doc))),
      h('div', { class: 'stack' },
        card('Holat', dl([['Holat', stateBadge(c)], c.reason ? ['Sabab', c.reason] : null, c.revokedAt ? ['Bekor qilingan', fmtDay(c.revokedAt)] : null,
          ['Status roʻyxati', h('span', null, h('code', null, '#' + c.statusIndex), ' · ' + STATUS_URL.replace('https://', ''))], ['Kalit', h('code', null, c.doc.proof.verificationMethod)],
          ['Amal qiladi', c.validUntil ? fmtDay(c.validUntil) + ' gacha' : 'muddatsiz'], ['PDF yuklab olingan', c.pdfDownloads + ' marta'],
          ['Chiqarilgan sana', h('span', null, fmtTime(c.issued), h('span', { class: 'sub' }, ' · Muhr jurnalida muhrlangan (konsept)'))]])),
        card('Tekshiruv natijasi', h('div', { class: 'toolbar' }, btn('Onlayn tekshirish', () => check(false), '', { id: 'cr-check' }), btn('Oflayn tekshirish', () => check(true), 'ghost', { id: 'cr-check-off' })), result),
        card('Bu imzo nimani isbotlaydi', h('div', { class: 'proves' },
          h('div', { class: 'yes' }, h('b', null, 'Isbotlaydi'), h('ul', null, h('li', null, 'sertifikatni ', ISSUER.name, ' kaliti bergan'), h('li', null, 'ism, kurs va sana oʻzgartirilmagan'), h('li', null, 'beruvchi uni bekor qilmagan (onlayn)'))),
          h('div', { class: 'no' }, h('b', null, 'Isbotlamaydi'), h('ul', null, h('li', null, 'egasining bilimini'), h('li', null, 'davlat diplomiga tengligini'), h('li', null, 'ZRU-793 boʻyicha ERI ekanini'))))))),
    dlg,
  ];
}

/* --- issue: one or a CSV batch --- */
const issueState = { mode: 'one', csv: null, preview: null, last: [] };
const SAMPLE_CSV = `ism,kurs,sana,baho
Madina Yusupova,python,${iso(NOW - 2 * DAY).slice(0, 10)},aʼlo
Sardor Nazarov,python,${iso(NOW - 2 * DAY).slice(0, 10)},yaxshi
Kamola Ergasheva,python,${iso(NOW - 2 * DAY).slice(0, 10)},aʼlo
Otabek Saidov,python,${iso(NOW - 2 * DAY).slice(0, 10)},qoniqarli
Zarina Hasanova,python,${iso(NOW - 2 * DAY).slice(0, 10)},yaxshi
,python,${iso(NOW - 2 * DAY).slice(0, 10)},aʼlo
Behruz Rahimov,pyton,${iso(NOW - 2 * DAY).slice(0, 10)},yaxshi
Laylo Qodirova,python,2026-13-40,aʼlo
Temur Usmonov,mentor,${iso(NOW - 1 * DAY).slice(0, 10)},
Sevara Mirzayeva,python,${iso(NOW - 2 * DAY).slice(0, 10)},aʼlo
Javlon Xolmatov,python,${iso(NOW + 9 * DAY).slice(0, 10)},yaxshi
Feruza Ismoilova,python,${iso(NOW - 2 * DAY).slice(0, 10)},yaxshi`;
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const head = lines.shift().split(',').map((x) => x.trim().toLowerCase());
  return lines.map((line, i) => {
    const v = line.split(','), row = Object.fromEntries(head.map((k, j) => [k, (v[j] || '').trim()]));
    const errors = [];
    if (!row.ism) errors.push('ism yoʻq');
    if (!achById(row.kurs)) errors.push('kurs topilmadi: «' + row.kurs + '»');
    const t = Date.parse(row.sana);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.sana) || isNaN(t)) errors.push('sana notoʻgʻri');
    else if (t > Date.now()) errors.push('sana kelajakda');
    return { line: i + 2, row, errors, t };
  });
}
async function issueOne(holder, achId, issued, grade) {
  const a = achById(achId);
  const n = Math.max(...creds.map((c) => c.statusIndex)) + 1;
  const c = { n: -1, id: 'c' + (2400 + n - 4100), holder, ach: achId, issued, statusIndex: n, grade: a.kind === 'Badge' ? null : grade || null, key: 'key-1',
    validUntil: a.years ? issued + a.years * 365 * DAY : null, state: 'active', pdfDownloads: 0, shared: false };
  c.doc = await signDoc(credDoc(c), ISSUER.id + '#key-1', Date.now());
  statusBits[c.statusIndex] = 0;
  creds.unshift(c);
  ach.find((x) => x.id === achId).issuedNow = (ach.find((x) => x.id === achId).issuedNow || 0) + 1;
  return c;
}
function issuePage() {
  const out = h('div', { class: 'stack' });
  function draw() {
    const tabs = h('div', { class: 'tabs', role: 'tablist' }, [['one', 'Bitta sertifikat'], ['csv', 'CSV dan toʻplam']].map(([k, t]) =>
      h('button', { type: 'button', role: 'tab', id: 'tab-' + k, class: issueState.mode === k ? 'on' : null, 'aria-selected': String(issueState.mode === k), onclick: () => { issueState.mode = k; draw(); } }, t)));
    let left;
    if (issueState.mode === 'one') {
      const name = h('input', { type: 'text', id: 'is-name', value: 'Nilufar Abdullayeva', 'aria-label': 'Ism familiya' });
      const course = h('select', { id: 'is-course', 'aria-label': 'Kurs' }, ach.map((a) => h('option', { value: a.id }, a.name + (a.kind === 'Badge' ? ' (badge)' : ''))));
      const date = h('input', { type: 'date', id: 'is-date', value: iso(NOW - DAY).slice(0, 10), 'aria-label': 'Sana' });
      const grade = h('select', { id: 'is-grade', 'aria-label': 'Baho' }, ['aʼlo', 'yaxshi', 'qoniqarli'].map((g) => h('option', null, g)));
      left = card(null, tabs,
        h('div', { class: 'form' }, h('label', { class: 'field col' }, h('span', null, 'Bitiruvchi (ism familiya)'), name), h('label', { class: 'field col' }, h('span', null, 'Kurs yoki badge'), course),
          h('div', { class: 'two' }, h('label', { class: 'field col' }, h('span', null, 'Sana'), date), h('label', { class: 'field col' }, h('span', null, 'Baho'), grade))),
        h('p', { class: 'note' }, 'Minimal maʼlumot: ism, kurs, sana, baho. Pasport, telefon, JShShIR yozilmaydi.'),
        h('div', { class: 'row-actions' }, btn('Imzolash va chiqarish', async () => {
          if (!name.value.trim()) { toast('Ism kerak'); return; }
          const c = await issueOne(name.value.trim(), course.value, Date.parse(date.value) || Date.now(), grade.value);
          issueState.last = [c]; toast('Imzolandi: ' + c.id.toUpperCase()); draw();
        }, 'primary', { id: 'is-go' }), h('span', { class: 'sub' }, 'Kalit: ' + ISSUER.id + '#key-1')));
    } else {
      const ta = h('textarea', { id: 'is-csv', rows: 12, spellcheck: 'false', 'aria-label': 'CSV' }); ta.value = issueState.csv ?? SAMPLE_CSV;
      ta.addEventListener('input', () => { issueState.csv = ta.value; issueState.preview = null; });
      const prev = issueState.preview;
      left = card(null, tabs, h('p', { class: 'sub' }, 'Ustunlar: ism, kurs (id: ' + ach.map((a) => a.id).join(', ') + '), sana, baho. Namuna ataylab xatolar bilan.'), ta,
        h('div', { class: 'row-actions' }, btn('Tekshirish', () => { issueState.csv = ta.value; issueState.preview = parseCsv(ta.value); draw(); }, '', { id: 'is-parse' }),
          prev ? btn(`${prev.filter((p) => !p.errors.length).length} tasini imzolash`, async () => {
            const ok = prev.filter((p) => !p.errors.length);
            issueState.last = [];
            for (const p of ok) issueState.last.push(await issueOne(p.row.ism, p.row.kurs, p.t, p.row.baho));
            issueState.preview = null; toast(ok.length + ' ta sertifikat imzolandi'); draw();
          }, 'primary', { id: 'is-batch', disabled: !prev.some((p) => !p.errors.length) }) : null),
        prev ? h('div', { class: 'table-wrap' }, h('table', { class: 'tbl compact', id: 'is-preview' }, h('thead', null, h('tr', null, h('th', null, 'Qator'), h('th', null, 'Ism'), h('th', null, 'Kurs'), h('th', null, 'Natija'))),
          h('tbody', null, prev.map((p) => h('tr', null, h('td', { class: 'mono' }, p.line), h('td', null, p.row.ism || '—'), h('td', null, achById(p.row.kurs)?.name || p.row.kurs),
            h('td', null, p.errors.length ? badge('bad', p.errors.join('; ')) : badge('ok', 'Tayyor'))))))) : null);
    }
    const right = issueState.last.length ? card(issueState.last.length > 1 ? issueState.last.length + ' ta sertifikat chiqarildi' : 'Sertifikat chiqarildi',
      certificate(issueState.last[0], { small: true }),
      issueState.last.length > 1 ? h('ul', { class: 'mini' }, issueState.last.map((c) => h('li', null, link('/credentials/' + c.id, c.holder), ' · ', h('code', null, c.id.toUpperCase())))) : null,
      h('div', { class: 'row-actions' }, btn('Ochish', () => go('/credentials/' + issueState.last[0].id), 'primary'), btn('Tekshiruvchida sinash', () => { verifyState.preset = JSON.stringify(issueState.last[0].doc, null, 2); go('/verify'); }))) :
      card('Qanday ishlaydi', h('ol', { class: 'steps-plain' },
        h('li', null, h('b', null, 'Maʼlumot kanonik JSON ga keltiriladi '), '(kalitlar tartiblangan, JCS ga oʻxshash).'),
        h('li', null, h('b', null, 'Beruvchi kaliti bilan imzolanadi: '), 'Ed25519, eddsa-jcs-2022 uslubida. Kalit OpenBao da, tashqariga chiqmaydi.'),
        h('li', null, h('b', null, 'Status roʻyxatida joy ajratiladi: '), 'bitta bit, keyin bekor qilish uchun.'),
        h('li', null, h('b', null, 'PDF va QR yasaladi: '), 'bitiruvchi uni akkauntsiz saqlaydi.'),
        h('li', null, h('b', null, 'Chiqarilgan sana Muhr jurnaliga yoziladi '), '(ixtiyoriy, konsept).')));
    out.replaceChildren(pageHead('Sertifikat chiqarish', 'Bitta bitiruvchi yoki CSV dan butun guruh. Imzo shu brauzerda, haqiqiy WebCrypto kaliti bilan.'), h('div', { class: 'grid-2 even' }, left, right));
  }
  draw();
  return out;
}

/* --- achievements (courses and badges) --- */
function achievementsPage() {
  const out = h('div', { class: 'stack' });
  function draw() {
    out.replaceChildren(pageHead('Kurslar va badgeʼlar', 'Open Badges 3.0 «Achievement» taʼriflari. Har sertifikat shulardan biriga ishora qiladi.',
      btn('Yangi badge', () => {
        const id = 'b' + (ach.length + 1);
        ach.push({ id, name: 'Yangi badge ' + (ach.length - 8), hours: 0, kind: 'Badge', narrative: 'Mezon: shu yerga yozing', years: 0 });
        ACHIEVEMENTS.push(ach[ach.length - 1]);
        toast('Badge qoʻshildi'); draw();
      }, 'primary', { id: 'ach-new' })),
    h('div', { class: 'cards-3' }, ach.map((a) => {
      const list = creds.filter((c) => c.ach === a.id);
      return h('section', { class: 'card ach' },
        h('div', { class: 'between' }, h('span', { class: 'ach-ico ' + (a.kind === 'Badge' ? 'is-badge' : '') }, a.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()), badge(a.kind === 'Badge' ? 'wait' : 'muted', a.kind)),
        h('h2', null, a.name), h('p', { class: 'sub' }, a.narrative),
        dl([['Chiqarilgan', num(list.length)], ['Amalda', num(list.filter((c) => credState(c) === 'active').length)], ['Soat', a.hours ? a.hours + ' soat' : '—'], ['Amal muddati', a.years ? a.years + ' yil' : 'muddatsiz']]),
        h('code', { class: 'sub' }, 'urn:sanad:' + ISSUER.domain + ':' + a.id));
    })));
  }
  draw();
  return out;
}

/* --- verifier --- */
const verifyState = { preset: null, offline: false };
function verdictBox(r) {
  const cls = r.verdict[0] === 'ok' ? 'v-ok' : r.verdict[0] === 'rev' ? 'v-rev' : 'v-bad';
  return h('div', { class: 'verdict ' + cls }, h('b', null, r.verdict[1]), h('span', null, r.verdict[2]));
}
function stepsList(r) {
  return [h('ol', { class: 'vsteps' }, r.steps.map(([t, d, k]) => h('li', { 'data-s': k }, h('i'), h('div', null, h('b', null, t), h('span', { class: 'sub' }, d))))),
    h('p', { class: 'sub' }, 'Tekshiruv ' + r.ms + ' ms · ' + (verifyState.offline ? 'internet ishlatilmadi' : 'faqat status roʻyxati onlayn olindi') + ' · kalitlar keshdan')];
}
function sampleSet() {
  const good = samples.good;
  const forgedName = C.clone(good.doc); forgedName.credentialSubject.name = 'Boshqa Odam';
  const forgedHours = C.clone(good.doc); forgedHours.credentialSubject.achievement.criteria.narrative = '144 soatlik kurs, 8 ta amaliy topshiriq va yakuniy loyiha';
  const revoked = creds.find((c) => c.state === 'revoked');
  const expired = creds.find((c) => credState(c) === 'expired');
  const old = creds.find((c) => c.key === 'key-0' && credState(c) === 'active');
  const unknownKey = C.clone(good.doc); unknownKey.proof.verificationMethod = ISSUER.id + '#key-9';
  return [
    ['good', 'Haqiqiy', good.doc],
    ['name', 'Ism oʻzgartirilgan', forgedName],
    ['hours', 'Soat oʻzgartirilgan', forgedHours],
    ['lookalike', 'Oʻxshash domen', samples.lookalike],
    ['revoked', 'Bekor qilingan', revoked.doc],
    ['expired', 'Muddati tugagan', expired.doc],
    ['oldkey', 'Eski kalit (key-0)', old.doc],
    ['other', 'Boshqa markaz', samples.otherTrusted],
    ['unknownkey', 'Notanish kalit', unknownKey],
    ['broken', 'Buzilgan JSON', '{ "type": ["VerifiableCredential"], "issuer": '],
  ];
}
function verifyPage() {
  const ta = h('textarea', { id: 'v-json', rows: 16, spellcheck: 'false', 'aria-label': 'VC JSON', placeholder: '{ "@context": [ "https://www.w3.org/ns/credentials/v2", … ] }' });
  const file = h('input', { type: 'file', id: 'v-file', class: 'sr-only', accept: '.json,application/json' });
  const offline = h('input', { type: 'checkbox', id: 'v-offline' }); offline.checked = verifyState.offline;
  const res = h('div', { class: 'stack', id: 'v-result', 'aria-live': 'polite' });
  const diff = h('div');
  let ref = null;
  async function check() {
    verifyState.offline = offline.checked;
    let doc;
    try { doc = JSON.parse(ta.value); } catch { doc = null; }
    const r = await verifyDoc(doc, { offline: offline.checked });
    res.replaceChildren(verdictBox(r), ...stepsList(r));
    diff.replaceChildren(doc && ref ? card('Hujjat (oʻzgargan maydonlar belgilangan)', jsonView(doc, ref)) : '');
  }
  file.addEventListener('change', async () => { const f = file.files[0]; if (f) { ta.value = await f.text(); ref = null; check(); } });
  offline.addEventListener('change', check);
  const chips = h('div', { class: 'chips' }, sampleSet().map(([k, t, doc]) => h('button', { type: 'button', class: 'fchip', 'data-case': k, onclick: () => {
    ta.value = typeof doc === 'string' ? doc : JSON.stringify(doc, null, 2);
    ref = ['name', 'hours'].includes(k) ? samples.good.doc : null;
    chips.querySelectorAll('.fchip').forEach((b) => b.classList.toggle('on', b.dataset.case === k));
    check();
  } }, t)));
  const out = h('div', { class: 'stack' },
    pageHead('Sertifikatni tekshirish', 'Imzo shu brauzerda tekshiriladi: beruvchining keshdagi kaliti bilan. Sayt «haqiqiy» degani emas, imzo mos kelgani muhim.'),
    card('Namunalar', h('p', { class: 'sub' }, 'Bir bosishda har bir holat: haqiqiy, soxtalashtirilgan, oʻxshash domen, bekor qilingan, muddati tugagan, eski kalit, notanish kalit, buzilgan fayl.'), chips),
    h('div', { class: 'grid-2 even' },
      card('VC fayli yoki QR ichidagi JSON', h('div', { class: 'between' }, h('label', { class: 'check' }, offline, h('span', null, h('b', null, 'Oflayn rejim. '), 'Status roʻyxati yuklanmaydi.')), h('label', { class: 'link-btn', for: 'v-file' }, 'Fayldan yuklash', file)),
        ta, h('div', { class: 'row-actions' }, btn('Tekshirish', check, 'primary', { id: 'v-check' }), h('span', { class: 'sub' }, 'Ishonchli roʻyxat: ' + TRUSTED.length + ' ta beruvchi'))),
      card('Natija', res)),
    diff);
  if (verifyState.preset) { ta.value = verifyState.preset; verifyState.preset = null; queueMicrotask(check); }
  else res.append(h('div', { class: 'empty' }, h('b', null, 'Natija shu yerda chiqadi'), h('p', { class: 'sub' }, 'Namunani tanlang yoki VC faylini qoʻying.')));
  return out;
}

/* --- keys, trust list, status list --- */
function trustPage() {
  const grid = h('div', { class: 'bits', role: 'img', 'aria-label': 'Status roʻyxati bitlari' });
  const idx = Object.keys(statusBits).map(Number).filter((i) => i >= 4100).sort((a, b) => a - b);
  for (const i of idx) grid.append(h('i', { class: statusBits[i] ? 'on' : null, title: '#' + i + (statusBits[i] ? ': bekor qilingan' : '') }));
  const revokedN = idx.filter((i) => statusBits[i]).length;
  return [
    pageHead('Kalitlar va ishonch', 'Tekshiruvchilar keshlaydigan narsalar: beruvchi kalitlari (did:web), ishonchli beruvchilar roʻyxati va bekor qilish roʻyxati.',
      btn('Kalitni almashtirish', async () => {
        const n = keyInfo.length;
        const vm = ISSUER.id + '#key-' + n;
        keys[vm] = await genKey();
        keyInfo.forEach((k) => { if (k.state === 'active') { k.state = 'retired'; k.to = Date.now(); } });
        keyInfo.push({ vm, state: 'active', from: Date.now(), to: null, where: 'OpenBao, transit engine' });
        toast('Yangi kalit: #key-' + n + '. Eski sertifikatlar tekshirilaveradi.'); route();
      }, '', { id: 'rotate' })),
    h('div', { class: 'grid-2 even' },
      card('Beruvchi kalitlari · ' + ISSUER.id, h('div', { class: 'table-wrap' }, h('table', { class: 'tbl compact' },
        h('thead', null, h('tr', null, h('th', null, 'Kalit'), h('th', null, 'Holat'), h('th', null, 'Davr'), h('th', null, 'Imzolagan'))),
        h('tbody', null, keyInfo.map((k) => h('tr', null, h('td', { class: 'mono' }, '#' + k.vm.split('#')[1]), h('td', null, k.state === 'active' ? badge('ok', 'Faol') : badge('muted', 'Nafaqada')),
          h('td', { class: 'sub' }, fmtShort(k.from) + ' – ' + (k.to ? fmtShort(k.to) : 'hozir')), h('td', { class: 'mono' }, num(creds.filter((c) => c.doc.proof.verificationMethod === k.vm).length))))))),
        h('p', { class: 'sub' }, 'Nafaqadagi kalit did.json da qoladi: u bilan imzolangan eski sertifikatlar tekshirilaveradi, lekin u bilan yangi imzo qoʻyilmaydi.'),
        h('pre', { class: 'code small' }, JSON.stringify({ id: ISSUER.id, verificationMethod: keyInfo.map((k) => ({ id: k.vm, type: 'Multikey', controller: ISSUER.id, publicKeyMultibase: 'z6Mk…(demo)' })), assertionMethod: keyInfo.filter((k) => k.state === 'active').map((k) => k.vm) }, null, 2))),
      card('Bekor qilish roʻyxati (Bitstring Status List)', h('p', { class: 'sub' }, idx.length + ' ta bit, ' + revokedN + ' tasi yoqilgan. Tekshiruvchi butun roʻyxatni oladi, shuning uchun beruvchi qaysi sertifikat tekshirilganini bilmaydi.'), grid,
        dl([['Manzil', h('code', null, STATUS_URL)], ['Hajm', '16 KB (siqilgan, 131 072 bit)'], ['Yangilangan', ago(Math.max(...creds.map((c) => c.revokedAt || 0)) || NOW)]]))),
    card('Ishonchli beruvchilar roʻyxati', h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, h('th', null, 'Beruvchi'), h('th', null, 'DID'), h('th', { class: 'hide-sm' }, 'Turi'), h('th', { class: 'hide-sm' }, 'Roʻyxatda'), h('th', null, 'Sertifikatlar'))),
      h('tbody', null, TRUSTED.map((t) => h('tr', null, h('td', null, h('b', null, t.name), t.mine ? h('span', { class: 'sub' }, ' · siz') : null), h('td', { class: 'mono' }, t.id), h('td', { class: 'hide-sm' }, t.kind),
        h('td', { class: 'hide-sm sub' }, t.since + ' kun'), h('td', { class: 'mono' }, num(t.mine ? creds.length : t.creds)))))))),
    card('Rad etilgan oʻxshash beruvchilar', h('p', { class: 'sub' }, 'Nomi bir xil, domeni boshqa. Ular imzoni toʻgʻri qoʻyishi mumkin, lekin roʻyxatda yoʻq: natija «soxta beruvchi».'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'tbl compact' }, h('thead', null, h('tr', null, h('th', null, 'DID'), h('th', null, 'Koʻrsatgan nomi'), h('th', null, 'Belgi'), h('th', null, '30 kunda'))),
        h('tbody', null, LOOKALIKES.map((l) => h('tr', null, h('td', { class: 'mono' }, l.id), h('td', null, l.name), h('td', null, badge('bad', l.why)), h('td', { class: 'mono' }, l.seen + ' marta'))))))),
  ];
}

/* --- holder --- */
function holderPage() {
  const mine = creds.filter((c) => c.holder === 'Dilnoza Karimova');
  return [
    pageHead('Bitiruvchi koʻrinishi', 'Dilnoza Karimova (toʻqima) oʻz sertifikatlarini shunday koʻradi. Akkaunt shart emas: PDF, QR yoki fayl yetarli.'),
    h('div', { class: 'cards-3 holder' }, mine.map((c) => h('div', { class: 'stack' }, certificate(c, { small: true }),
      h('div', { class: 'row-actions' }, btn('Ulashish havolasi', async () => { try { await navigator.clipboard.writeText('https://verify.sanad.example/#' + c.id); toast('Havola nusxalandi'); } catch { toast('Nusxalab boʻlmadi'); } }),
        btn('Tekshirish', () => { verifyState.preset = JSON.stringify(c.doc, null, 2); go('/verify'); }, 'ghost'))))),
    card('Bitiruvchi nimani nazorat qiladi', h('ul', { class: 'steps-plain' },
      h('li', null, h('b', null, 'Sertifikat uning qoʻlida. '), 'Markaz yopilsa ham imzo tekshirilaveradi (kalit keshlarda).'),
      h('li', null, h('b', null, 'Kimga koʻrsatishni oʻzi tanlaydi. '), 'Tekshiruv beruvchiga xabar bermaydi.'),
      h('li', null, h('b', null, 'Keyin: hamyon ilovasi. '), 'OpenID4VCI orqali; MVP da yoʻq.'))),
  ];
}

/* --- Telegram bot (concept mock) --- */
const chat = [];
let botLang = 'uz';
const BOT_TEXT = {
  uz: { hello: 'Assalomu alaykum! Sertifikatdagi QR rasmini yuboring: imzosini tekshiraman. Rasm saqlanmaydi.', issuer: 'Beruvchi', holder: 'Egasi', bare: 'Bu QR ichida faqat havola bor, imzo yoʻq. Havola qayerga olib borishidan qatʼi nazar, bunday QR hech narsani isbotlamaydi.', help: 'QR rasmini yoki VC faylini yuboring.\n/til — tilni almashtirish.\nMen hech qachon pul, parol yoki kod soʻramayman.' },
  en: { hello: 'Hello! Send a photo of the QR code on a certificate and I will check its signature. The photo is not stored.', issuer: 'Issuer', holder: 'Holder', bare: 'This QR code holds only a link, no signature. Wherever the link points, a QR like this proves nothing.', help: 'Send a QR photo or a VC file.\n/lang to switch language.\nI never ask for money, passwords or codes.' },
};
function botVerdictText(r, lang) {
  const L = C.strings(lang) || C.strings('uz');
  const T = BOT_TEXT[lang] || BOT_TEXT.uz;
  const v = r.verdict[1] === 'Haqiqiy' ? [L.vOk, L.vOkD] : r.verdict[1] === 'Bekor qilingan' || r.verdict[1] === 'Muddati tugagan' ? [L.vRev, L.vRevD] : r.verdict[1] === 'Soxta beruvchi' ? [L.vFake, L.vFakeD] : [L.vBad, L.vBadD];
  return `${v[0]}\n${v[1]}\n\n${T.holder}: ${r.holder || '—'}\n${T.issuer}: ${r.issuerId || '—'}`;
}
function seedChat() {
  if (chat.length) return;
  const t = NOW - 26 * 3600e3;
  chat.push({ me: true, at: t, text: '/start' }, { at: t + 1e3, text: BOT_TEXT.uz.hello },
    { me: true, at: t + 60e3, photo: samples.good.holder, caseKey: 'good' },
    { at: t + 62e3, text: 'Haqiqiy\nImzo mos, beruvchi tanish, bekor qilinmagan.\n\nEgasi: ' + samples.good.holder + '\nBeruvchi: ' + ISSUER.id, ok: true },
    { me: true, at: NOW - 2 * 3600e3, photo: 'Boshqa Odam', caseKey: 'name' },
    { at: NOW - 2 * 3600e3 + 2e3, text: 'Soxta\nImzo mos emas: maʼlumot imzodan keyin oʻzgargan.\n\nEgasi: Boshqa Odam\nBeruvchi: ' + ISSUER.id, ok: false });
}
function botPage() {
  seedChat();
  const list = h('div', { class: 'chat-list', id: 'chat' });
  function draw() {
    list.replaceChildren(...chat.map((m) => h('div', { class: 'msg' + (m.me ? ' me' : '') + (m.ok === true ? ' good' : m.ok === false ? ' bad' : '') },
      m.photo ? h('div', { class: 'photo' }, pseudoQr(m.photo + m.caseKey), h('span', { class: 'sub' }, 'QR rasmi · ' + m.photo)) : null,
      m.text ? h('p', null, m.text) : null,
      h('span', { class: 'time' }, pad(new Date(m.at).getHours()) + ':' + pad(new Date(m.at).getMinutes())))));
    list.scrollTop = list.scrollHeight;
  }
  async function send(caseKey, label) {
    const set = Object.fromEntries(sampleSet().map(([k, , d]) => [k, d]));
    chat.push({ me: true, at: Date.now(), photo: label, caseKey });
    if (caseKey === 'bare') chat.push({ at: Date.now(), text: BOT_TEXT[botLang].bare, ok: false });
    else { const r = await verifyDoc(set[caseKey]); chat.push({ at: Date.now(), text: botVerdictText(r, botLang), ok: r.verdict[0] === 'ok' ? true : false }); }
    draw();
  }
  const kb = (t, fn, id) => h('button', { type: 'button', class: 'kb', onclick: fn, id }, t);
  queueMicrotask(draw);
  return [
    pageHead('Telegram bot', 'Konsept: bot hali yoʻq (4-hafta rejasi). Rasm oʻrniga namuna tanlanadi; imzo tekshiruvi esa haqiqiy.'),
    h('div', { class: 'grid-2' },
      h('div', { class: 'phone' }, h('div', { class: 'phone-top' }, mark(), h('div', null, h('b', null, 'Sanad bot'), h('span', { class: 'sub' }, 'bot · konsept · til: ' + botLang))), list,
        h('div', { class: 'kbs' },
          kb('Haqiqiy sertifikat', () => send('good', samples.good.holder), 'bot-good'),
          kb('Ismi oʻzgartirilgan', () => send('name', 'Boshqa Odam'), 'bot-name'),
          kb('Oʻxshash domen', () => send('lookalike', samples.good.holder), 'bot-look'),
          kb('Bekor qilingan', () => send('revoked', creds.find((c) => c.state === 'revoked').holder), 'bot-rev'),
          kb('Faqat havolali QR', () => send('bare', 'oddiy QR'), 'bot-bare'),
          kb(botLang === 'uz' ? '/til → English' : '/lang → oʻzbekcha', () => { botLang = botLang === 'uz' ? 'en' : 'uz'; chat.push({ me: true, at: Date.now(), text: botLang === 'en' ? '/lang' : '/til' }, { at: Date.now(), text: BOT_TEXT[botLang].help }); route(); }, 'bot-lang'))),
      card('Bot qanday ishlaydi', h('ol', { class: 'steps-plain' },
        h('li', null, h('b', null, 'QR rasmini yuborasiz. '), 'Bot QR ichidagi VC ni oʻqiydi, rasmni saqlamaydi.'),
        h('li', null, h('b', null, 'Imzo keshdagi kalit bilan tekshiriladi. '), 'Beruvchi sayti ishlamasa ham.'),
        h('li', null, h('b', null, 'Uch natija: '), 'haqiqiy, soxta yoki bekor qilingan. DID va domen aniq koʻrsatiladi.'),
        h('li', null, h('b', null, 'Imzosiz QR '), '«tekshirib boʻlmaydi» deb belgilanadi: QR bu manzil, imzo emas.'),
        h('li', null, h('b', null, 'Til: '), 'oʻzbek, ingliz, rus (rejada).')),
        h('p', { class: 'note' }, 'Sanad hech qachon pul, parol, SMS kod yoki kalit soʻramaydi.'))),
  ];
}

function about() {
  const rows = [
    ['Ed25519 imzo va tekshiruv (WebCrypto)', 'Haqiqiy', 'har yuklanishda yangi kalit, eksport qilinmaydi'],
    ['Kanonik JSON va SHA-256', 'Haqiqiy', 'JCS ga oʻxshash, sanad-core.js'],
    ['Bekor qilish (status bit), kalit almashtirish', 'Haqiqiy (xotirada)', 'qayta yuklanganda tiklanadi'],
    ['did:web hal qilish, status roʻyxati serveri', 'Simulyatsiya', 'mahalliy kesh, tarmoqqa chiqilmaydi'],
    ['PDF, QR rasmi', 'Simulyatsiya', 'QR namunasi skanerlanmaydi'],
    ['Telegram bot, issuer API, OpenBao', 'Rejada', 'docs/PLAN.md, 8 haftalik MVP'],
    ['Muhr bilan sana muhri', 'Rejada', 'ixtiyoriy anchoring'],
    ['Odamlar, markazlar, domenlar, raqamlar', 'Toʻqima', '.example domenlari, oʻylab topilgan ismlar'],
  ];
  return [
    pageHead('Bu konsept demo', 'Sanad hali chiqmagan. Bu sahifalar rejalashtirilgan mahsulotni toʻqima maʼlumotlarda koʻrsatadi.'),
    card('Nima haqiqiy, nima simulyatsiya', h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'Qism'), h('th', null, 'Holat'), h('th', null, 'Izoh'))),
      h('tbody', null, rows.map(([a, b, c]) => h('tr', null, h('td', null, a), h('td', null, badge(b.startsWith('Haqiqiy') ? 'ok' : b === 'Simulyatsiya' ? 'warn' : 'muted', b)), h('td', { class: 'sub' }, c))))))),
    h('div', { class: 'grid-2 even' },
      card('Nima emas', h('ul', { class: 'steps-plain' }, h('li', null, 'Davlat diplomi yoki ID oʻrnini bosmaydi, ularga taqlid qilmaydi.'), h('li', null, 'Sanad imzosi ZRU-793 boʻyicha malakali ERI emas.'),
        h('li', null, 'Imzo kim berganini isbotlaydi, egasining bilimini emas.'), h('li', null, 'Token, blokcheyn toʻlovi, custody yoʻq.'))),
      card('Havolalar', h('ul', { class: 'links' }, h('li', null, h('a', { href: 'https://sanad.wonmor.io/' }, 'sanad.wonmor.io'), ' · bosh sahifa'),
        h('li', null, h('a', { href: 'https://github.com/wonmortech/sanad' }, 'github.com/wonmortech/sanad'), ' · kod va reja'),
        h('li', null, h('a', { href: 'https://www.w3.org/TR/vc-data-model-2.0/' }, 'W3C VC 2.0')), h('li', null, h('a', { href: 'https://www.w3.org/TR/vc-bitstring-status-list/' }, 'Bitstring Status List'))))),
  ];
}
function notFound(title = 'Sahifa topilmadi', sub = 'Bunday manzil yoʻq.') {
  return h('div', { class: 'empty big' }, h('b', null, title), h('p', { class: 'sub' }, sub), btn('Kabinetga', () => go('/'), 'primary'));
}

/* ---------- router ---------- */
function route() {
  const path = (location.hash.replace(/^#/, '') || '/').split('?')[0];
  const p = path.split('/').filter(Boolean);
  let view;
  if (!p.length) view = dashboard();
  else if (p[0] === 'credentials' && p[1]) view = credentialDetail(p[1]);
  else if (p[0] === 'credentials') view = credentialsPage();
  else if (p[0] === 'issue') view = issuePage();
  else if (p[0] === 'achievements') view = achievementsPage();
  else if (p[0] === 'verify') view = verifyPage();
  else if (p[0] === 'trust') view = trustPage();
  else if (p[0] === 'holder') view = holderPage();
  else if (p[0] === 'bot') view = botPage();
  else if (p[0] === 'about') view = about();
  else view = notFound();
  shell(path, view);
  document.title = (document.querySelector('main h1')?.textContent || 'Sanad') + ' · Sanad konsept demo';
  document.documentElement.dataset.ready = '1';
}
const ROUTES = 'credentials|issue|achievements|verify|trust|holder|bot|about';
if (!location.hash && new RegExp('/(' + ROUTES + ')(/|$)').test(location.pathname)) {
  const m = location.pathname.match(new RegExp('/(' + ROUTES + ')(/.*)?$'));
  history.replaceState(null, '', location.pathname.slice(0, m.index + 1) + '#/' + m[1] + (m[2] || ''));
}

if (!subtle || !C) {
  document.getElementById('app').replaceChildren(h('div', { class: 'empty big' }, h('b', null, 'Brauzeringizda WebCrypto yoʻq'), h('p', { class: 'sub' }, 'Demo imzolarni haqiqiy kalit bilan qoʻyadi; buning uchun zamonaviy brauzer kerak.')));
} else {
  document.getElementById('app').replaceChildren(h('div', { class: 'boot' }, mark(), h('span', null, creds.length + ' ta sertifikat imzolanmoqda…')));
  buildWorld().then(() => { window.addEventListener('hashchange', route); route(); });
}
