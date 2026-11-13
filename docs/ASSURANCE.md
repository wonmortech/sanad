# Assurance case

This document explains why we believe the Sanad website meets its security requirements: what is in scope, what we
protect against, how the design applies secure design principles, which common weaknesses are countered, what the
latest security review found, what risk remains, and which automated tests back each claim.

Last review: 2026-11-14, covering every file in `site/assets/js/`, `tools/check-site.mjs`, `tests/serve.mjs`,
`deploy/` and `.github/workflows/`.

## 1. Scope

In scope:

- The static website in `site/` (Uzbek `/`, English `/en/`, Russian `/ru/`, `404.html`), served as-is with no build
  step, no server-side code, no cookies, no forms that submit anywhere and no third-party resources.
- The site scripts: `theme.js` (applies a saved theme before first paint), `main.js` (page behaviour and animations),
  `sanad-core.js` (demo logic without the DOM) and `demo.js` (wires the demo to the page).
- The in-browser demo, which signs a sample credential with a real Ed25519 key (WebCrypto) and verifies it again
  whenever the visitor edits a field.
- The delivery chain: GitHub repository and Actions, the deploy workflow, the receiving script on the server
  (`deploy/receive.sh`), the site container (`deploy/Caddyfile`, `deploy/docker-compose.yml`) and the shared edge
  proxy in front of it.

Out of scope: the future Sanad product (credential issuing service, Telegram bot, verifier), which does not exist yet.
The demo illustrates its verification model; it is not that product and it is not a verifier for real certificates.

## 2. Threat model

### Assets

| Asset | Why it matters |
| --- | --- |
| Integrity of the published pages | Visitors must get exactly what is in `main`: a defaced or script-injected page could mislead them or attack their browser. |
| Visitors' browsers | The site must never become a way to run attacker code in a visitor's browser (XSS, malicious third-party script). |
| Honesty of the demo | The demo claims that an edited certificate fails verification. If it could show "Genuine" for edited data, the page would teach the wrong lesson. |
| Deploy credentials | The CI deploy key and the pinned host key, stored as GitHub Actions secrets. |
| Availability | Lower priority: the site is informational. |

There is no personal data, no account system and no secret in the site. The demo keys are generated in the visitor's
browser on each load, are non-extractable and are never sent anywhere.

### Actors

- **Visitor**: trusted with their own browser only. Fully controls every input of the demo.
- **Forger (demo role)**: the visitor acting as an attacker who edits the name or course hours, swaps in a lookalike
  issuer's signature or flips revocation. The demo must classify every such edit correctly.
- **Network attacker**: can observe or modify traffic between visitor and site.
- **Malicious or compromised contributor**: can open pull requests with arbitrary content.
- **Compromised dependency**: a malicious version of a test-only npm package or a GitHub Action.
- **Holder of the deploy key** (for example, if a GitHub secret leaked).
- **Operator of the shared edge proxy or the host**: fully trusted; see residual risks.

### Trust boundaries

```
 visitor's browser ──TLS (HSTS)──▶ shared edge proxy ──internal network──▶ site container (Caddy, read-only files)
        ▲                                                                       ▲
        │ CSP: only same-origin scripts, styles, fonts, images                  │ releases/<sha>, atomic symlink swap
        │                                                                       │
 GitHub repo ──PR + required check `build`──▶ main ──deploy workflow──SSH, forced command──▶ receive script
```

1. **Browser ↔ site.** Everything the browser receives is static and same-origin. The CSP
   (`default-src 'self'; script-src 'self'; ... frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`)
   means only our own script files run; inline scripts and event handlers are blocked. Inside the page, demo input is
   untrusted and only ever reaches the DOM through an escaping function or `textContent`.
2. **Edge proxy ↔ site container.** The edge terminates TLS and adds `Strict-Transport-Security`; the container sets
   CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy`.
   The container mounts its config and releases read-only.
3. **CI ↔ server.** The `build` job (pull requests) has `contents: read` and no secrets. Only the deploy job on
   `main` sees the deploy secrets. The server binds the key with `restrict,command=...` to `receive`, which accepts
   only `deploy <40-hex sha>`, `rollback` or `status`, caps the upload size, extracts into a fresh temporary
   directory without preserving owners or permissions, rejects links and special files, requires
   `site/version.txt` to match the commit, validates a new Caddyfile before using it, and switches releases with an
   atomic symlink swap. The host key is pinned (`StrictHostKeyChecking=yes`), never trusted on first use.
4. **Repository ↔ dependencies.** GitHub Actions are pinned to full commit SHAs; the only npm dependency is the
   test runner `@playwright/test`, pinned to an exact version with a lockfile and installed with `npm ci`. It is used
   only by the `build` job, which holds no secrets; the deploy job never installs npm packages.

## 3. Secure design principles

| Principle | How it is applied |
| --- | --- |
| Economy of mechanism | No build step, no backend, no runtime dependencies, about 600 lines of first-party JavaScript. The demo logic is one DOM-free file that is unit tested on its own. |
| Fail-safe defaults | CSP denies everything not explicitly same-origin. The demo verdict is checked in a fixed order (signature, then trust, then status) and starts from "not verified". A missing, malformed or unknown status entry counts as revoked. Malformed proofs, unknown keys and decoding errors all end as "Forged". |
| Complete mediation | Every edit re-runs canonicalisation, hashing and signature verification from scratch; nothing is cached between runs except the keys. Every string that reaches `innerHTML` passes through `esc()`. |
| Open design | All code is public. Security rests on standard algorithms (Ed25519, SHA-256 via WebCrypto) and the CSP, not on secrecy. |
| Separation of privilege | Pull request checks run without secrets; deploying needs a merge to `main` (required `build` check, code owners) and the deploy secrets; the server accepts only the forced command. |
| Least privilege | Workflows request `contents: read` only. Demo private keys are non-extractable. `Permissions-Policy` disables camera, microphone and geolocation. The site container gets read-only mounts. |
| Least common mechanism | The site runs in its own container with its own Caddy config; the shared edge only proxies to it. |
| Psychological acceptability | The demo shows each verification step and explains the verdict in plain language in all three site languages. |
| Input validation | Canonical JSON rejects values JSON cannot carry exactly; base64url decoding is strict; the status index must be a plain decimal; key lookups use own properties only; `receive` validates its command and archive. |

## 4. Common weaknesses countered

| Weakness | Countermeasure | Verified by |
| --- | --- | --- |
| Cross-site scripting (CWE-79, OWASP A03) | All dynamic HTML is built by `sanad-core.js` and every value is escaped with `esc()` (`& < > " '`); state attributes come from a fixed whitelist; elsewhere `textContent` is used. CSP `script-src 'self'` blocks inline script even if escaping failed. | Unit tests "render escapes user-controlled values and keys", "steps for every outcome, escaped", "li accepts only known states"; e2e test "markup typed into the name field is shown as text, never run" for each language; `tools/check-site.mjs` rejects inline scripts and handlers. |
| Inclusion of functionality from an untrusted control sphere (CWE-829) | No third-party scripts, styles, fonts or images; fonts are self-hosted. CSP `default-src 'self'`. | `tools/check-site.mjs` fails on third-party `src`, `srcset`, stylesheet links and CSS `url()`; e2e tests fail on any console error, which includes CSP violations, with the production CSP served. |
| Clickjacking (CWE-1021) | `frame-ancestors 'none'` and `X-Frame-Options: DENY` at the edge. | e2e checks the CSP header served from `deploy/Caddyfile`; the deploy smoke test checks the live CSP. |
| Cleartext transmission (CWE-319) | HTTPS only, HSTS (`max-age=31536000`) from the edge proxy. | `curl -sI https://sanad.wonmor.io/` |
| MIME confusion | `X-Content-Type-Options: nosniff`, explicit content types. | Header check as above. |
| Use of a broken or risky cryptographic algorithm / own crypto (CWE-327) | No home-made cryptography: Ed25519 (fallback ECDSA P-256 where the browser lacks Ed25519) and SHA-256 through the browser's WebCrypto. | Unit tests sign and verify with Node's WebCrypto, including the fallback path. |
| Improper verification of a cryptographic signature (CWE-347) | The signature covers both the credential and the proof options; the key is resolved from the proof's key id; the issuer named in the credential must equal the key's DID and be on the trust list. | Unit tests: every signed field and every proof option edit gives "Forged"; key reordering stays "Genuine"; a lookalike issuer gives "Fake issuer"; attacker key under the issuer's key id fails. |
| Canonicalisation ambiguity (CWE-180-like) | Sorted keys, no whitespace, JSON escaping; values JSON cannot carry exactly are rejected instead of silently changed. | Unit tests for key order, Unicode order, escaping, numbers and rejected values. |
| Exposure of secrets (CWE-798, CWE-200) | No secrets in the repository; deploy secrets live in GitHub secrets; demo keys are non-extractable and ephemeral. | `tools/check-site.mjs` scans published files for private keys, tokens, server addresses and personal contact data; unit test "private keys are not extractable". |
| Path traversal (CWE-22) | Production serves files with Caddy's `file_server`; the test server resolves paths and refuses anything outside `site/`. `receive` extracts into a temporary directory and rejects links and special files. | e2e test "the test server never serves files outside site/". |
| Vulnerable and outdated components (OWASP A06) | Runtime has no components; Actions pinned to SHAs; Dependabot monthly for Actions and npm. | `.github/dependabot.yml` |

## 5. Security review (2026-11-14)

Method: line-by-line reading of every site script, searching for DOM sinks (`innerHTML`, `outerHTML`,
`insertAdjacentHTML`, `document.write`, `eval`, `Function`, string timers), URL handling (`location`, `href`,
`hash`, `postMessage`, `fetch`), storage use and every cryptographic step of the demo; then the static checker, the
test server, the deploy scripts and the workflows.

| # | Finding | Severity | Fix |
| --- | --- | --- | --- |
| 1 | The demo signed only the credential. The proof options (`created`, `cryptosuite`, `proofPurpose`, `verificationMethod`) shown in the JSON were not covered, so they could be changed and the certificate would still show "Genuine". | Medium for a real verifier; low here | The signed input is now `SHA-256(canon(proof options)) ‖ SHA-256(canon(credential))`, modelled on `eddsa-jcs-2022`. The verifier also requires `type: DataIntegrityProof` and `proofPurpose: assertionMethod`. The page note in all three languages was updated to say so. |
| 2 | Canonical JSON passed `undefined` and functions through as the literal text `undefined` and turned `NaN`/`Infinity` into `null`, so two different values could canonicalise the same or produce non-JSON. | Low | `canon()` now throws on anything JSON cannot carry exactly (undefined, functions, symbols, bigint, non-finite numbers, non-plain objects). |
| 3 | The multibase prefix `u` of `proofValue` was not checked and the base64url decoder accepted `+`, `/`, padding and impossible lengths. | Low | The prefix is required; `unb64u()` accepts only the base64url alphabet without padding and rejects impossible lengths. |
| 4 | The revocation lookup failed open: an unknown index meant "not revoked", and `parseInt` accepted `"7abc"` as 7. | Low (the index is signed) | `isRevoked()` accepts only a plain decimal index present in the status list; anything else counts as revoked. |
| 5 | The key resolver used plain property access, so a key id such as `__proto__` or `constructor` reached `subtle.verify` with a non-key object (the exception was caught, so no bypass). | Info | Own-property lookups only. |
| 6 | `esc()` did not escape `'`. Not exploitable, since no generated attribute is single-quoted, but fragile. | Info | `'` is now escaped; generated `data-s` states come from a whitelist. |
| 7 | `main.js` sets `innerHTML` for the decorative QR pattern. | None | The SVG is built from numbers only (seed parsed with `parseInt` from a page-authored attribute). |
| 8 | `theme.js` reads `localStorage`. | None | Only the exact values `light` and `dark` are applied. |

No use of `eval`, `Function`, string timers, `document.write`, `postMessage`, `fetch` or URL parameters was found. The
demo logic was moved into `site/assets/js/sanad-core.js` (no DOM access) so it can be unit tested; `demo.js` keeps
only the DOM wiring and the page behaves as before.

## 6. Residual risks

- **The demo key is a sample, not an issuer.** Keys are generated fresh in the browser on each load. The `did:web`
  documents, the trust list and the status list are local objects, not resolved over the network. A "Genuine" result
  in the demo says nothing about any real certificate.
- **Simplified canonicalisation.** `canon()` follows JCS (RFC 8785) for the data the demo produces, but it is not a
  full, independently tested JCS implementation. The real product must use a conformant one and the full
  `eddsa-jcs-2022` cryptosuite.
- **Algorithm fallback.** In browsers without Ed25519 the demo uses ECDSA P-256 and says so on screen. This depends
  on the browser, not on attacker input.
- **`style-src 'unsafe-inline'`.** Needed for a few `style` attributes. Without an HTML injection it gives an
  attacker nothing; HTML injection is countered as described above.
- **HSTS** is set without `includeSubDomains` and `preload`, so the very first visit over plain HTTP can still be
  intercepted.
- **Trusted infrastructure.** Whoever controls the shared edge proxy, the host, the GitHub organisation or the
  deploy secrets can publish arbitrary pages. The forced command limits a leaked deploy key to publishing or rolling
  back releases (no shell), and every release is a commit SHA verified live after deploy, but defacement remains
  possible.
- **Test-only supply chain.** A malicious Playwright release could tamper with CI test results. It never runs with
  deploy secrets and never ships in `site/`.

## 7. How the tests back the claims

`npm test` (run in the required `build` CI job on every pull request) runs:

1. **Unit tests** (`tests/unit/*.test.mjs`, Node's built-in `node:test`) for `sanad-core.js`: canonical form,
   encodings, escaping, strings in all three languages, signing and verification with real WebCrypto keys (including
   the ECDSA fallback), every tampering case, status handling and the generated HTML. A coverage gate fails the run
   below 90 % lines, 80 % branches or 90 % functions for `sanad-core.js`.
2. **End-to-end tests** (`tests/e2e/`, Playwright with Chromium) against `site/` served by `tests/serve.mjs` with the
   security headers read from `deploy/Caddyfile`: each page loads with zero console errors (so zero CSP violations),
   zero page errors and zero failed requests; the certificate scan reaches `data-state="ok"` with and without motion
   and `"bad"` for the forged one; editing the name or hours makes the real signature check fail and undoing the edit
   makes it pass; the lookalike issuer and revocation give their own verdicts; markup typed into the demo is shown
   as text; the theme toggle and the language links work; unknown paths return the 404 page with status 404.

`node tools/check-site.mjs` runs before tests and before every deploy, and the deploy workflow then checks the live
revision, status codes and CSP header, rolling back automatically on failure.
