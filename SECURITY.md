# Security policy

## Supported versions

Sanad is in the planning stage. The only thing running is the home page at https://sanad.wonmor.io, deployed from the
`main` branch. Security fixes go to `main` and are deployed to the site; there are no older versions to patch.
When releases exist, the latest release receives fixes.

## Reporting a vulnerability

Please **do not** open a public issue, pull request or discussion for a vulnerability.

1. Preferred: GitHub private vulnerability reporting, in this repository's **Security** tab,
   then **Report a vulnerability**: <https://github.com/wonmortech/sanad/security/advisories/new>.
2. If you cannot use GitHub: a private message on Telegram to <https://t.me/xnosir>. A short first message such as
   "Security report for Sanad" is enough; we will agree on a safe way to share the details.

Include the affected URL or file, the steps to reproduce, and what an attacker could gain. Never send live
credentials or other people's personal data, even as proof.

## What happens next

| Step | What we do | Within |
|---|---|---|
| Acknowledge | Confirm we received your report | 7 days |
| Assess | Reproduce it and rate its severity (CVSS) | 14 days |
| Fix | Fix and deploy high and critical issues, sooner where possible | 60 days |
| Disclose | Publish a GitHub security advisory (and a CVE where needed) with the fix | With the fix |

We credit reporters in the advisory if they wish. Good-faith research that follows the
[organization security policy](https://github.com/wonmortech/.github/blob/main/SECURITY.md) is welcome and
covered by its safe-harbour section. There is no paid bug bounty.

## Verifying a release

Each release on GitHub carries the site archive, a `SHA256SUMS` file and build provenance. The archive is built
twice and compared byte for byte, and the provenance is signed with Sigstore (GitHub artifact attestations) by
[.github/workflows/release.yml](.github/workflows/release.yml). To check a download, with the
[GitHub CLI](https://cli.github.com/):

```sh
gh release download v0.1.0 -R wonmortech/sanad
sha256sum -c SHA256SUMS
gh attestation verify sanad-site-0.1.0.tar.gz -R wonmortech/sanad
```

`sha256sum -c` must print `OK` for the archive, and `gh attestation verify` must report that the archive was
built by the release workflow of `wonmortech/sanad`. Replace `v0.1.0` and `0.1.0` with the release you downloaded.

## More

A machine-readable contact file is published at [https://sanad.wonmor.io/.well-known/security.txt](https://sanad.wonmor.io/.well-known/security.txt).
The security design of the project is described in [docs/ASSURANCE.md](docs/ASSURANCE.md).
