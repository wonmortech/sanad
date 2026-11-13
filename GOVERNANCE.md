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

The organization has more than one owner, so the repository, the domain configuration and the deployment
secrets remain accessible if one person is unavailable. Deployment is automated from `main`
([.github/workflows/deploy.yml](.github/workflows/deploy.yml)), so no single machine is needed to publish.
We are a small team today and say so openly: growing the number of active maintainers is a goal of the plan.

## Security

Vulnerability reports follow [SECURITY.md](SECURITY.md). Only maintainers see private advisories.
