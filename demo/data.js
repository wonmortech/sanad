// SPDX-FileCopyrightText: 2026 Wonmor and Sanad contributors
// SPDX-License-Identifier: Apache-2.0

/* Fictional, deterministic sample data for the concept demo. Every person, centre, domain and number here is
   invented (domains use the reserved .example zone). Dates are relative to the moment the page loads. */

export const DAY = 864e5;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* The issuer whose console the demo shows, the other trusted issuers, and lookalikes the trust list rejects. */
export const ISSUER = { id: 'did:web:ilmyoli.example', name: 'Ilm Yoʻli oʻquv markazi', city: 'Toshkent, Mirzo Ulugʻbek tumani', domain: 'ilmyoli.example' };
export const TRUSTED = [
  { id: ISSUER.id, name: ISSUER.name, kind: 'Oʻquv markazi', since: 120, creds: 0, mine: true },
  { id: 'did:web:raqamliavlod.example', name: 'Raqamli Avlod IT akademiyasi', kind: 'IT kurslar', since: 96, creds: 2140 },
  { id: 'did:web:samtil.example', name: 'Samarqand Til Markazi', kind: 'Til kurslari', since: 81, creds: 905 },
  { id: 'did:web:dizaynmaktab.example', name: 'Dizayn Maktabi', kind: 'Dizayn', since: 64, creds: 377 },
  { id: 'did:web:hakaton-uz.example', name: 'Ochiq Hakaton tashkilotchilari', kind: 'Tadbir', since: 40, creds: 612 },
  { id: 'did:web:robotlar.example', name: 'Yosh Robototexniklar klubi', kind: 'Bolalar kurslari', since: 28, creds: 154 },
  { id: 'did:web:buxgalter-kurs.example', name: 'Buxgalter Pro kurslari', kind: 'Kasbiy kurs', since: 17, creds: 268 },
  { id: 'did:web:wonmor.io', name: 'Wonmor ochiq loyihalari (pilot, rejada)', kind: 'Hissa badgeʼlari', since: 5, creds: 12 },
];
export const LOOKALIKES = [
  { id: 'did:web:ilmyo1i.example', name: 'Ilm Yoʻli oʻquv markazi', why: '“l” oʻrniga “1”: oʻxshash domen', seen: 9 },
  { id: 'did:web:ilmyoli-uz.example', name: 'Ilm Yoʻli oʻquv markazi', why: 'tire bilan oʻxshash domen', seen: 4 },
  { id: 'did:web:raqamli-avlod.example', name: 'Raqamli Avlod IT akademiyasi', why: 'tire qoʻshilgan oʻxshash domen', seen: 2 },
];

export const ACHIEVEMENTS = [
  { id: 'python', name: 'Python asoslari', hours: 72, kind: 'Sertifikat', narrative: '72 soatlik kurs, 8 ta amaliy topshiriq va yakuniy loyiha', years: 0 },
  { id: 'react', name: 'Frontend: React', hours: 144, kind: 'Sertifikat', narrative: '144 soatlik kurs va jamoaviy yakuniy loyiha', years: 0 },
  { id: 'design', name: 'Grafik dizayn', hours: 96, kind: 'Sertifikat', narrative: '96 soatlik kurs va 12 ishlik portfolio', years: 0 },
  { id: 'english', name: 'Ingliz tili B2', hours: 120, kind: 'Sertifikat', narrative: 'B2 darajadagi yakuniy imtihon (4 koʻnikma)', years: 2 },
  { id: 'data', name: 'Maʼlumotlar tahlili', hours: 108, kind: 'Sertifikat', narrative: '108 soatlik kurs: SQL, Python, vizualizatsiya', years: 0 },
  { id: 'flutter', name: 'Mobil dasturlash: Flutter', hours: 132, kind: 'Sertifikat', narrative: '132 soatlik kurs va doʻkonga chiqarilgan ilova', years: 0 },
  { id: 'onec', name: 'Buxgalteriya: 1C', hours: 64, kind: 'Sertifikat', narrative: '64 soatlik amaliy kurs', years: 3 },
  { id: 'mentor', name: 'Mentor', hours: 0, kind: 'Badge', narrative: 'Kamida 2 guruhga yordamchi mentor boʻlgan', years: 0 },
  { id: 'hackathon', name: 'Hakaton gʻolibi', hours: 0, kind: 'Badge', narrative: 'Markaz hakatonida 1–3-oʻrin', years: 0 },
];

const FIRST_M = ['Jasur', 'Sardor', 'Bekzod', 'Otabek', 'Aziz', 'Shoxrux', 'Doniyor', 'Akmal', 'Javlon', 'Ulugʻbek', 'Sanjar', 'Temur', 'Islom', 'Farrux', 'Behruz', 'Abdulloh'];
const FIRST_F = ['Dilnoza', 'Malika', 'Madina', 'Nilufar', 'Shahnoza', 'Gulnora', 'Zarina', 'Sevara', 'Kamola', 'Mohinur', 'Feruza', 'Sabina', 'Laylo', 'Munisa'];
const LAST = ['Karimov', 'Rustamov', 'Toshmatov', 'Yusupov', 'Abdullayev', 'Nazarov', 'Ergashev', 'Qodirov', 'Rahimov', 'Saidov', 'Hasanov', 'Mirzayev', 'Usmonov', 'Xolmatov', 'Ismoilov', 'Joʻrayev'];
const REVOKE_REASONS = ['Ism xato yozilgan: toʻgʻrilangan sertifikat qayta chiqarildi', 'Kurs toʻlovi qaytarildi', 'Yakuniy loyiha koʻchirilgani aniqlandi', 'Bitiruvchining iltimosi bilan'];

/* 186 credentials over the last 12 months, newest first. */
export function seed(now) {
  const r = rng(31337);
  const creds = [];
  for (let i = 0; i < 186; i++) {
    const f = r() < 0.52;
    const holder = (f ? FIRST_F : FIRST_M)[Math.floor(r() * (f ? FIRST_F.length : FIRST_M.length))] + ' ' + LAST[Math.floor(r() * LAST.length)] + (f ? 'a' : '');
    const ach = ACHIEVEMENTS[i % 11 < 9 ? i % 9 : (i % 2 ? 0 : 1)];
    const ageDays = Math.floor(Math.pow(i / 186, 1.15) * 360) + 1;
    const issued = now - ageDays * DAY - Math.floor(r() * 9) * 3600e3;
    creds.push({
      n: i, id: 'c' + (2400 + 186 - i), holder, ach: ach.id, issued, statusIndex: 4100 + 186 - i,
      grade: ach.kind === 'Badge' ? null : ['aʼlo', 'yaxshi', 'aʼlo', 'qoniqarli', 'yaxshi'][i % 5],
      key: ageDays > 150 ? 'key-0' : 'key-1',
      validUntil: ach.years ? issued + ach.years * 365 * DAY : null,
      state: 'active',
      pdfDownloads: Math.floor(r() * 6), shared: r() < 0.6,
    });
  }
  // a few revoked ones (with reasons), and old English certificates already past validUntil
  [7, 23, 61, 118].forEach((i, k) => { creds[i].state = 'revoked'; creds[i].revokedAt = creds[i].issued + (3 + k * 5) * DAY; creds[i].reason = REVOKE_REASONS[k]; });
  creds.filter((c) => c.ach === 'english').slice(-3).forEach((c) => { c.validUntil = now - (10 + c.n % 40) * DAY; c.issued = c.validUntil - 730 * DAY; });
  // one graduate with several credentials, for the holder view
  [3, 40, 95].forEach((i) => { creds[i].holder = 'Dilnoza Karimova'; });

  // anonymous bot statistics: how many checks per day and their verdicts (no identities, by design)
  const checks = [];
  for (let d = 29; d >= 0; d--) {
    const day = now - d * DAY;
    const wd = new Date(day).getDay();
    const base = wd === 0 || wd === 6 ? 40 : 110;
    const ok = Math.round(base * (0.8 + r() * 0.5));
    checks.push({ day, ok, bad: Math.round(r() * 5 + (d % 9 === 3 ? 6 : 0)), fake: Math.round(r() * 3), rev: Math.round(r() * 2), qr: Math.round(r() * 7 + 2) });
  }
  return { creds, checks };
}
