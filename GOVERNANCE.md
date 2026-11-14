# Governance

Sanad is a project of [Wonmor](https://wonmor.io), run in the public `wonmortech` GitHub organization.

## Roles

| Role | Who | Can do |
|---|---|---|
| Maintainer | [@wonmors](https://github.com/wonmors) (founder, project lead), [@xnosir](https://github.com/xnosir) (technical maintainer) | Review and merge pull requests, triage issues, cut releases, handle security reports |
| Contributor | Anyone who opens an issue or a pull request | Propose changes; becomes a maintainer after sustained, reviewed contributions and the maintainers' agreement |

The `core` team of the organization holds admin rights; `maintainers` and `contributors` teams map to the roles above.

## Decisions

Day-to-day decisions are made in issues and pull requests. A change merges after review and green CI
([CONTRIBUTING.md](CONTRIBUTING.md)). Larger decisions (scope, licence, architecture, anything in
[docs/PLAN.md](docs/PLAN.md)) are proposed in an issue, stay open for at least 7 days for comments, and are
recorded in the plan. When maintainers disagree, the project lead (@wonmors) decides and writes down why.

## Continuity

Two independent people hold owner rights in the `wonmortech` organization and maintain the project:

- [@wonmors](https://github.com/wonmors), the founder and project lead;
- [@xnosir](https://github.com/xnosir), the technical maintainer.

Each signs in with their own account and two-factor authentication, which the organization requires of every
member. Either one alone can create and close issues, review and merge, cut a release, deploy the site and handle
security reports, so the project continues if one of them is unavailable.
Beyond the two owners, continuity rests on:

- automated deployment from `main` ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)), so no single
  machine is needed to publish the site;
- the code, history, issues and releases are public on GitHub under the Apache-2.0 licence, so anyone can fork
  and continue the project.

We also say this openly: while the project is being set up, the technical maintainer runs some repository
automation on the founder's behalf, with tokens the founder delegated. When setup is finished the founder
revokes those tokens and runs the account alone. Until then, a pull request opened through that automation
and approved by @xnosir has the same person behind both steps.

## Open goals

- **Shared access to the server and the DNS.** The server that hosts the site and the DNS of `wonmor.io` are
  administered by the technical maintainer today. The site keeps deploying from GitHub Actions without them,
  but the founder should also hold that access, with the steps written down.
- **More active maintainers.** Contributors become maintainers as described under [Roles](#roles). A maintainer
  from outside Wonmor would make the project independent of a single organization.

## Security

Vulnerability reports follow [SECURITY.md](SECURITY.md). Only maintainers see private advisories.
