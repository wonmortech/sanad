# Contributing to Sanad

Thank you for helping. Sanad is certificates that carry their own signature and can be verified offline. It is in the planning stage: today the repository holds the research
([docs/research/](docs/research/)), the plan ([docs/PLAN.md](docs/PLAN.md)) and the home page ([site/](site/)).

## Ways to contribute

| You want to | Do this |
|---|---|
| Report a bug or a mistake on the site | Open an issue with the **Bug** template |
| Suggest an idea or a change to the plan | Open an issue with the **Idea** template |
| Correct a research source or a legal reference | Open a pull request that links the primary source |
| Report a vulnerability | Not a public issue: see [SECURITY.md](SECURITY.md) |

Good first issues are labelled [`good first issue`](https://github.com/wonmortech/sanad/labels/good%20first%20issue).

## Development

Requirements: Node.js 24 and Git. There is no build step: `site/` is served as it is.

```sh
npm ci                                  # test tools only; the site has no runtime dependencies
npx playwright install chromium         # once, for the browser tests
node tools/check-site.mjs               # links, CSP rules, forbidden text
npm run lint                            # ESLint; a warning fails like an error
npm test                                # unit tests, browser tests, then the combined coverage gate
pipx run reuse lint                     # SPDX header or REUSE.toml entry for every file
```

## Requirements for a change

- **Tests.** New behaviour and every bug fix come with an automated test in `tests/`. CI runs `npm test` on
  every pull request. It has two coverage gates: the unit tests alone must cover the demo logic
  (`site/assets/js/sanad-core.js`: 90 % lines, 80 % branches, 90 % functions), and the unit and browser tests
  together must cover all site JavaScript (every `site/**/*.js`: 90 % statements and lines, 90 % functions, 80 %
  branches). The combined report merges Node and Chromium V8 coverage with c8 and is written to `coverage/`; no
  file or line is excluded from it. c8 counts statements per line, so statements equal lines.
- **The CSP.** The site is served with `default-src 'self'`: no inline `<script>`, no inline event handlers and
  no third-party origins. `tools/check-site.mjs` enforces this.
- **Coding standard.** Plain modern JavaScript (ES2022), checked by ESLint (`eslint.config.mjs`: the recommended
  rules plus no `eval`/`new Function`, no unused variables and `===` except `== null`), no frameworks and no
  runtime dependencies; build the DOM with `textContent` and DOM APIs, never `innerHTML` with data. Keep each language page (`/`, `/en/`, `/ru/`)
  in sync, and keep the page accessible (WCAG 2.2 AA: contrast, focus, keyboard, `prefers-reduced-motion`).
- **Honesty.** Plans are labelled as plans. A claim or a number needs a source someone else can check.
- **One topic per pull request**, Conventional Commits style (`feat:`, `fix:`, `docs:`, `test:`).

## Developer Certificate of Origin (DCO)

Every commit must be signed off, which certifies that you wrote it or have the right to submit it under the
project licence ([developercertificate.org](https://developercertificate.org/)):

```sh
git commit -s -m "fix: ..."
```

This adds a `Signed-off-by: Your Name <email>` line. The `dco` check fails a pull request that has an
unsigned commit; fix it with `git rebase --signoff origin/main` and push again.

## Review and merge

Every change goes through a pull request. It needs green CI (`build`, `dco`) and at least one approving review
from a maintainer other than the author whenever another maintainer is available ([GOVERNANCE.md](GOVERNANCE.md)).
We squash-merge and delete the branch.

## Licence and conduct

Contributions are released under the [Apache License 2.0](LICENSE). No CLA is required.
Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
