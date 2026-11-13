# Governance

Sanad is a project of [Wonmor](https://wonmor.io), run in the public `wonmortech` GitHub organization.

## Roles

| Role | Who | Can do |
|---|---|---|
| Maintainer | [@wonmors](https://github.com/wonmors), [@XakimovNosirbek](https://github.com/XakimovNosirbek) | Review and merge pull requests, triage issues, cut releases, handle security reports |
| Contributor | Anyone who opens an issue or a pull request | Propose changes; becomes a maintainer after sustained, reviewed contributions and the maintainers' agreement |

The `core` team of the organization holds admin rights; `maintainers` and `contributors` teams map to the roles above.

## Decisions

Day-to-day decisions are made in issues and pull requests. A change merges after review and green CI
([CONTRIBUTING.md](CONTRIBUTING.md)). Larger decisions (scope, licence, architecture, anything in
[docs/PLAN.md](docs/PLAN.md)) are proposed in an issue, stay open for at least 7 days for comments, and are
recorded in the plan. When maintainers disagree, the project lead (@wonmors) decides and writes down why.

## Continuity

Said plainly: both maintainer accounts above currently belong to the founder, so today Sanad has one person behind
it. What keeps the project going if that person is unavailable:

- The code, history, issues and releases are public on GitHub under the Apache-2.0 licence, so anyone can fork
  and continue the project.
- Access to the `wonmortech` organization and its secrets rests on the organization's and the owner accounts'
  recovery settings on GitHub.
- Deployment is automated from `main` ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)), so no
  single machine is needed to publish the site.

This is not yet the "bus factor of two" that a mature project needs; closing that gap is an
[open goal](#open-goal-an-independent-second-owner).

### Open goal: an independent second owner

We want a second, independent person as an organization owner and maintainer, with their own account and their
own access to the repository, the domain configuration and the deployment secrets. Until then, nobody else holds
those rights, and we do not claim otherwise. Contributors who build a record of reviewed work are the natural
candidates (see Roles above).

## Security

Vulnerability reports follow [SECURITY.md](SECURITY.md). Only maintainers see private advisories.
