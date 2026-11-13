# Manbalar va standartlar

> Har bir havola 2026-11-13 da ochilgan. Holat va sana sahifaning oʻzidan olingan. «(snippet)» = faqat qidiruv natijasi; «(ochilmadi)» = 403/404.

## 1. Asosiy standartlar (Sanad shularga quriladi)

| Standart | Havola | Holat (sahifadan) | Sanad uchun nima |
|---|---|---|---|
| W3C Verifiable Credentials Data Model 2.0 | [w3.org/TR/vc-data-model-2.0](https://www.w3.org/TR/vc-data-model-2.0/) | W3C Recommendation, 2025-05-15 | Sertifikat = VC. Asosiy maʼlumot modeli |
| VC Data Integrity 1.0 | [w3.org/TR/vc-data-integrity](https://www.w3.org/TR/vc-data-integrity/) | W3C Recommendation, 2025-05-15 | Imzo (`proof`) qanday qoʻyiladi va tekshiriladi |
| Data Integrity EdDSA Cryptosuites | [w3.org/TR/vc-di-eddsa](https://www.w3.org/TR/vc-di-eddsa/) | W3C Recommendation, 2025-05-15; `eddsa-rdfc-2022` va `eddsa-jcs-2022` ni belgilaydi | Ed25519 imzo; `eddsa-jcs-2022` JSON uchun oddiyroq |
| Bitstring Status List | [w3.org/TR/vc-bitstring-status-list](https://www.w3.org/TR/vc-bitstring-status-list/) | W3C Recommendation, 2025-05-15 | Bekor qilish roʻyxati; tekshiruvchi qaysi sertifikatni soʻraganini oshkor qilmaydi |
| Open Badges 3.0 | [imsglobal.org/spec/ob/v3p0](https://www.imsglobal.org/spec/ob/v3p0/) · [GitHub](https://github.com/1EdTech/openbadges-specification) | 1EdTech Final Release, hujjat versiyasi 1.4.5 (2026-06-29); VC Data Model 2.0 ga mos | Kurs badgeʼlari va «Achievement» sxemasi |
| did:web | [w3c-ccg.github.io/did-method-web](https://w3c-ccg.github.io/did-method-web/) | W3C CCG hujjati; sahifada holat va sana koʻrsatilmagan | Beruvchi kaliti oʻz domenida: `did:web:markaz.uz` |
| OpenID for Verifiable Credential Issuance 1.0 | [openid.net](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html) | Final, 2025-09-16 | Keyinroq: hamyonlarga standart chiqarish |
| OpenID for Verifiable Presentations 1.0 | [openid.net](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html) | Final, 2025-07-09 | Keyinroq: hamyondan koʻrsatish |

## 2. Qoʻshimcha va kontekst

| Standart | Havola | Holat | Izoh |
|---|---|---|---|
| VC JOSE COSE | [w3.org/TR/vc-jose-cose](https://www.w3.org/TR/vc-jose-cose/) | W3C Recommendation, **2026-10-13** | JWT/COSE bilan himoyalash muqobili; MVP da ishlatilmaydi |
| DID Core 1.0 | [w3.org/TR/did-1.0](https://www.w3.org/TR/did-1.0/) | W3C Recommendation, 2022-07-19 | DID asosi |
| DID 1.1 | [w3.org/TR/did-1.1](https://www.w3.org/TR/did-1.1/) | Candidate Recommendation Snapshot, 2026-03-05 | Hali yakunlanmagan |
| did:key | [w3c-ccg.github.io/did-key-spec](https://w3c-ccg.github.io/did-key-spec/) | «The did:key Method v0.9», holat koʻrsatilmagan | Test va oflayn namunalar uchun |
| SD-JWT | [RFC 9901](https://www.rfc-editor.org/info/rfc9901) | IETF Proposed Standard, 2025-11 | Selective disclosure: faqat kerakli maydonni koʻrsatish |
| SD-JWT VC | [datatracker](https://datatracker.ietf.org/doc/draft-ietf-oauth-sd-jwt-vc/) | draft-26 (2026-11-06), IESG koʻrigida, hali RFC emas | Kuzatib boramiz |
| ISO/IEC 18013-5 (mobil haydovchilik guvohnomasi) | [iso.org/standard/69084](https://www.iso.org/standard/69084.html) | **(ochilmadi, 403)**; 2-nashri DIS/CD bosqichida (snippet) | Faqat kontekst: davlat ID uchun oflayn tekshiruv namunasi |
| RFC 8032 EdDSA | [rfc-editor.org/rfc/rfc8032](https://www.rfc-editor.org/rfc/rfc8032) | Informational, 2017-01 | Ed25519 algoritmi |
| W3C Web Cryptography | [w3.org/TR/webcrypto](https://www.w3.org/TR/webcrypto/) · [Editor's Draft](https://w3c.github.io/webcrypto/) | Working Draft 2025-04-22; Editor's Draft 2026-10-22; ikkalasida Ed25519 boʻlimi bor | Brauzerda tekshirish (saytdagi demo shuni ishlatadi) |
| Telegram Bot API | [core.telegram.org/bots/api](https://core.telegram.org/bots/api) | Bot API 10.4, 2026-11-09 | Tekshiruvchi bot |
| Telegram Mini App blokcheyn qoidalari | [core.telegram.org/bots/blockchain-guidelines](https://core.telegram.org/bots/blockchain-guidelines) | — | Oddiy botga taalluqli emas (REPORT §1.5); Sanad blokcheyn ishlatmaydi |

## 3. Ochiq kod (ishlatish mumkin)

| Repo | Litsenziya | Sanad uchun |
|---|---|---|
| [walt-id/waltid-identity](https://github.com/walt-id/waltid-identity) | Apache-2.0 | Issuer/verifier xizmati (Docker REST), .NET dan chaqiriladi |
| [digitalbazaar/vc](https://github.com/digitalbazaar/vc) | BSD-3-Clause | JS da issue/verify; README hali «VC Data Model 1.0» deydi, VC 2.0 tasdiqlanmagan |
| [decentralized-identity/veramo](https://github.com/decentralized-identity/veramo) | Apache-2.0 | TS DID/VC agent |
| [openwallet-foundation/credo-ts](https://github.com/openwallet-foundation/credo-ts) | Apache-2.0 | TS identity freymvork, OpenID4VC |
| [digitalcredentials/learner-credential-wallet](https://github.com/digitalcredentials/learner-credential-wallet) | MIT | Ochiq hamyon namunasi |
| [blockchain-certificates/cert-verifier-js](https://github.com/blockchain-certificates/cert-verifier-js) | MIT | Tekshiruvchi tuzilmasi namunasi |

## 4. Oʻqish uchun

| Manba | Havola | Asosiy fikr |
|---|---|---|
| Ink & Switch, *Local-first software* (Kleppmann va b., 2019-04) | [inkandswitch.com/essay/local-first](https://www.inkandswitch.com/essay/local-first/) | Maʼlumot egasi foydalanuvchi; Sanadda sertifikat holderda turadi |
| Yoshlar ishlari agentligi, *Soxta sertifikatning narxi* (2024-07-08) | [gov.uz/en/yoshlar/news/view/15837](https://gov.uz/en/yoshlar/news/view/15837) | Soxta QR soxta saytga bogʻlangan; Sanad uchun asosiy dalil |
| Peter Todd, *OpenTimestamps announcement* (2016-09-15) | [petertodd.org](https://petertodd.org/2016/opentimestamps-announcement) | Vaqt isboti ≠ muallif isboti; Muhr bilan bogʻliq qism uchun (REPORT §5) |
| Moxie Marlinspike, *My first impressions of web3* (2022-01-07) | [moxie.org](https://moxie.org/2022/01/07/web3-first-impressions.html) | Mijoz tomonida tekshirish, markazlashuvni ochiq aytish (REPORT §5) |

Oxirgi ikki qator Wonmor web3 tadqiqotida (REPORT.md, §5) oʻqilgan; bu papka uchun qayta ochilmagan.
