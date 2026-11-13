# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/). Version 0.x means the project is in planning: the site and the
documents change, there is no released product yet.

## [Unreleased]

### Added
- Property-based tests with fast-check on random input, run in CI with the unit tests.
- ESLint (`npm run lint`, warnings fail) over the site scripts, tests and tools, run in the CI `build` job.
- Coverage of all site JavaScript: Chromium coverage from the browser tests is merged with the unit-test coverage
  and gated in CI at 90 % statements and lines, 90 % functions and 80 % branches over every `site/**/*.js` file.
- Browser tests for the mobile menu, the animations with motion allowed (tilt, chain rail, chat), switching motion
  on at runtime, the theme with storage blocked, and the demo without WebCrypto or without Ed25519.
- SPDX copyright and licence headers in every source file, `REUSE.toml` for the rest, `LICENSES/`, and a
  `reuse lint` check in the CI `build` job.
- "Verifying a release" section in SECURITY.md.

### Changed
- GOVERNANCE.md states the real continuity situation (both maintainer accounts belong to the founder) and lists an
  independent second owner as an open goal.
- README: contact options now include SECURITY.md and Telegram for vulnerabilities; the licence note no longer
  says the `LICENSE` file is still to come.

### Fixed
- Removed an unused variable in the certificate scan code (found by ESLint).

## [0.1.0] - 2026-11-14

### Added
- Research with competitors, standards and legal notes in `docs/research/`, and the plan in `docs/PLAN.md`.
- Home page at https://sanad.wonmor.io in Uzbek, English and Russian, with light and dark themes and an in-browser demo.
- Share card image per language.
- Automatic deployment from `main` with live verification and rollback.
- Automated tests: unit tests with a coverage gate and browser tests for every language page, run in CI.
- Security assurance case ([docs/ASSURANCE.md](docs/ASSURANCE.md)), security policy and `security.txt`.
- Governance, contributing guide with DCO sign-off, code of conduct, issue and pull request templates.
- OpenSSF Scorecard workflow, and reproducible release archives with signed build provenance.

[Unreleased]: https://github.com/wonmortech/sanad/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/wonmortech/sanad/releases/tag/v0.1.0
