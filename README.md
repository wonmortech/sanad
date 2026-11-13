# Sanad

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/16669/badge)](https://www.bestpractices.dev/projects/16669)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/wonmortech/sanad/badge)](https://scorecard.dev/viewer/?uri=github.com/wonmortech/sanad)
[![CI](https://github.com/wonmortech/sanad/actions/workflows/ci.yml/badge.svg)](https://github.com/wonmortech/sanad/actions/workflows/ci.yml)
[![Mozilla Observatory A+](https://img.shields.io/badge/Mozilla_Observatory-A%2B-brightgreen)](https://developer.mozilla.org/en-US/observatory/analyze?host=sanad.wonmor.io)
[![SSL Labs A+](https://img.shields.io/badge/SSL_Labs-A%2B-brightgreen)](https://www.ssllabs.com/ssltest/analyze.html?d=sanad.wonmor.io)

**Certificates that carry their own signature.** Sanad issues course certificates, badges and references as
[W3C Verifiable Credentials 2.0](https://www.w3.org/TR/vc-data-model-2.0/) (compatible with
[Open Badges 3.0](https://www.imsglobal.org/spec/ob/v3p0/)) and lets anyone verify them **offline**, through a
Telegram bot or a web page.

> **Status: planning. Nothing is released yet.** There is no issuer, no bot and no issued credential today.
> What exists: the research, the plan and the home page (with an in-browser signature demo).

Site: https://sanad.wonmor.io · Docs: [`docs/`](docs/) · Plan: [`docs/PLAN.md`](docs/PLAN.md)

## Why

A QR code on a certificate is only an address. Forgers in Uzbekistan have already built a lookalike
"verification site" and pointed their fake QR codes at it
([gov.uz, 2024-07-08](https://gov.uz/en/yoshlar/news/view/15837)). A page that says "valid" proves nothing.
A signature does: change one letter and the check fails, wherever and whoever runs it.

Sanad is coinless: no token, no blockchain payments, no custody of anything.

## How it will work

1. **Issue.** A training centre uploads its graduates (CSV). Sanad signs one credential per graduate with the
   centre's key, published at `did:web:<centre-domain>`, and renders a printable PDF with the credential inside a QR code.
2. **Hold.** The graduate keeps the PDF, the QR or the file. No account and no website are needed to keep it valid.
3. **Verify.** An employer sends a photo of the QR to the Telegram bot or opens the web verifier. The signature is
   checked against the issuer's cached key, on the device, without a network. Only the optional revocation check
   ([Bitstring Status List](https://www.w3.org/TR/vc-bitstring-status-list/)) needs to go online.

Results are one of: **genuine**, **forged** (signature does not match, or the key is not the issuer's), or **revoked**.

Sanad will share its key management and Merkle-log core with its sister project Muhr; the issue date of a
credential can be anchored there.

## What it is not

- Not a replacement for state diplomas or IDs, and it does not imitate them. Private issuers only.
- A Sanad signature is not a qualified electronic digital signature under Uzbek law (ZRU-793).
- The signature proves who issued the certificate, not what the holder knows.

## Repository layout

```
docs/research/   research in Uzbek: competitors, references, inspiration, legal notes
docs/PLAN.md     goals, architecture, MVP milestones, risks, open questions
site/            the static home page (no build step)
tests/           unit, property-based and browser tests
tools/           site checker and coverage helper
deploy/          Caddy configuration and deploy scripts
```

To preview the site, run `npm run serve` (it sends the production security headers), or serve `site/` with any
static server. Development and the checks a change must pass: [CONTRIBUTING.md](CONTRIBUTING.md).

## Contact

Questions, bugs and ideas: open a [GitHub issue](https://github.com/wonmortech/sanad/issues).
Vulnerabilities: not in public, see [SECURITY.md](SECURITY.md) (GitHub private reporting, or Telegram
<https://t.me/xnosir>). Wonmor will never ask you for money, passwords or keys.

## Releases

Release archives come with `SHA256SUMS` and Sigstore-signed build provenance:
see [Verifying a release](SECURITY.md#verifying-a-release).

## License

[Apache-2.0](LICENSE). Fonts in `site/fonts/` are under the SIL Open Font License 1.1 (see the `LICENSE-*.txt`
files there). Every file states its copyright and licence in an SPDX header or in [REUSE.toml](REUSE.toml), and
CI checks this with [`reuse lint`](https://reuse.software/); the licence texts are in [LICENSES/](LICENSES/).

---

A [Wonmor](https://wonmor.io) project · sisters: [Muhr](https://muhr.wonmor.io), [Shaffof](https://shaffof.wonmor.io)
