# Sanad tadqiqoti

> **Sana:** 2026-11-13 · **Holat:** rejalashtirish bosqichi, kod yoʻq · **Til:** oʻzbek (lotin)
> Asosiy manba: Wonmor web3 tadqiqoti (`REPORT.md`, §1.6, §3, §4, §7.2, §8, §9). Bu papkadagi har bir havola 2026-11-13 da ochib tekshirilgan; ochilmagani alohida belgilangan.

## Qisqacha

**Sanad** kurs sertifikati, badge va maʼlumotnomalarni **W3C Verifiable Credentials 2.0** shaklida (Open Badges 3.0 bilan mos) chiqaradi va ularni Telegram bot yoki veb sahifa orqali **oflayn** tekshirish imkonini beradi.

- **Muammo:** QR kod faqat manzil. Yoshlar ishlari agentligi soxtakorlar «haqiqiysiga oʻxshash soxta sayt yasab, uni soxta QR kodiga bogʻlagani»ni yozgan ([gov.uz, 2024-07-08](https://gov.uz/en/yoshlar/news/view/15837)). Xususiy kurs sertifikatlarini tekshirishning standart usuli esa umuman yoʻq.
- **Yechim:** imzo sertifikatning oʻzida turadi. Tekshiruvchi beruvchining keshlangan kaliti bilan imzoni joyida tekshiradi. Internet faqat ixtiyoriy bekor qilish tekshiruvi uchun kerak.
- **Standartlar tayyor:** VC Data Model 2.0, Data Integrity, EdDSA cryptosuites va Bitstring Status List 2025-05-15 da W3C Recommendation boʻlgan; OpenID4VCI 1.0 2025-09-16 da Final boʻlgan. Tafsilot: [references.md](references.md).
- **Tangasiz:** token, blokcheyn toʻlovi va custody yoʻq. Kripto-aktiv bilan ishlanmaydi, shuning uchun NAPP litsenziyasi kerak emas deb hisoblaymiz (yurist tasdiqlashi kerak, [legal.md](legal.md)).
- **Raqobat:** bozorda SaaS badge platformalari koʻp (Credly, Accredible, Certifier va b.), lekin ular tekshiruvni oʻz saytiga bogʻlaydi, oʻzbek tilida va Telegramʼda ishlamaydi. Oʻzbekistonda davlat diplomlari uchun baza bor (diplom.edu.uz), xususiy sertifikatlar uchun ochiq tekshiruv topilmadi. Tafsilot: [competitors.md](competitors.md).
- **Tartib:** Muhr (1–8 hafta) → Sanad (9–16 hafta) → Shaffof. Sanad Muhr bilan kalit va Merkle jurnal yadrosini boʻlishadi.

## Mundarija

| Fayl | Nima bor |
|---|---|
| [competitors.md](competitors.md) | Raqobatchilar va muqobillar jadvali: nima qiladi, narx/litsenziya, biz nima olamiz, qayerda farq qilamiz |
| [references.md](references.md) | Standartlar, kutubxonalar va oʻqish uchun manbalar (havola + holati + sanasi) |
| [inspiration.md](inspiration.md) | Dizayn va mahsulot uchun ilhom manbalari, har biridan nima olamiz |
| [legal.md](legal.md) | Shaxsiy maʼlumotlar, lokalizatsiya, rozilik, elektron imzo holati va yuristga savollar |
| [../PLAN.md](../PLAN.md) | Maqsadlar, arxitektura, MVP bosqichlari, xavflar, ochiq savollar |

## Tekshirish qoidasi

- Har bir raqam yoki sana manbaga bogʻlangan. Manbasiz raqam yozilmaydi.
- «(snippet)» = faqat qidiruv natijasida koʻrilgan, sahifa toʻliq oʻqilmagan.
- «(ochilmadi)» = sahifa 403/404 qaytardi.
- Narxlar raqobatchilarning oʻz sahifasidan 2026-11-13 da olingan va oʻzgarishi mumkin.
