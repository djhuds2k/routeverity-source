# RouteVerity working tracker

RouteVerity uses a deliberately small active Next.js application with independent
campaigns, transparent redirects, click reporting, conversions and Google Ads
template support. Milestone 7 production-safety work is in progress; local
implementation is not a claim of deployment or Google certification. Permitted
upstream routes are retained outside the shipping route tree as a reference,
not restored product functionality. Restricted trees remain excluded.

- Node **22.23.2** (supported LTS), pnpm **9.15.9**.
- Setup and services: [local development](docs/local-development.md).
- Dedicated product checks and managed browser acceptance: [CI](docs/ci.md).
- Public copy, approved identity and release-gated indexing: [public site](docs/public-site.md).
- Release preparation and acceptance boundaries: [source release](docs/source-release.md)
  and [independent restoration](docs/source-restoration.md). The completion plan
  and release-readiness records are private operational documents, intentionally
  omitted from public source. Security, licensing, hosted recovery and merchant
  acceptance remain launch gates.
- Framework security preparation (E176): Next **15.5.28**, with Next's Sharp
  pinned to **0.35.5**. Further runtime dependency remediation and refreshed
  release notices/source remain required.
- SMTP security preparation (E177): email sign-in and operational alerts use
  **Nodemailer 10.3.0**.
- Validation/ID security preparation (E178): active **Zod 4.6.7** and patched
  **Nano ID 5.1.16 / 3.3.18**. Retained upstream Zod 3 and remaining dependency
  reachability/remediation still require review before release.
- Shipping-dependency review (E179, 2026-10-30): patched seven advisory matches
  observed in emitted modules and removed two unused web SDKs. The Windows
  inventory has no remaining exact-version matches; vendored framework versions,
  other workspace findings and target-platform release review remain open.
- Current source preparation (E182, 2026-10-30): candidate7 includes refreshed
  Ubuntu Linux inventory/notices. Four attribution gaps and native/security/legal
  review remain open. See [source release](docs/source-release.md); no new archive
  is published and the historical footer URL is unchanged.
- Vendor security repair (E184, 2026-10-30): a version-bound pnpm Next patch and
  exact dependency extensions repair the reviewed vendor behavior. Build-time
  byte checks enforce installation; candidate8 preparation supersedes candidate7
  for this revision. See [repair details](docs/security-vendor-patch.md).
- Workspace cleanup (E186, 2026-10-31): removed unused SAML/direct matcher inputs
  and pinned follow-redirects1.16.2. Audit findings drop487→385; wider security
  acceptance remains open. See [dependency review](docs/workspace-dependency-review.md)
  and candidate9 preparation in the source-release guide.
- Product checks: `pnpm routeverity:licenses`, `pnpm routeverity:lint`,
  `pnpm routeverity:test`, `pnpm routeverity:typecheck`, `pnpm routeverity:build`.
- Start: `pnpm routeverity:dev`, or after a build `pnpm routeverity:start`.
- Scope: [disabled/deferred upstream features](docs/disabled-upstream-features.md).
- Campaign configuration and architecture: [architecture](docs/current-architecture.md).
- Transparent `/click` contract: [redirect engine](docs/transparent-redirect.md).
- Audit integrity: `pnpm routeverity:redirect-audit`.
- Click reports/export and async worker: [click analytics](docs/click-analytics.md).
- Drain metadata enrichment: `pnpm routeverity:enrich-clicks` (or `--watch`).
- Independent server conversions: [integration and reporting](docs/conversions.md).
- Google templates and bounded source schema: [Google Ads setup](docs/google-ads.md).
- Licensing: [compliance preparation](docs/open-source-compliance.md).
- Historical preproduction source archive:
  [v0.1.0-preproduction.20261007](https://github.com/djhuds2k/routeverity-source/archive/refs/tags/v0.1.0-preproduction.20261007.zip).
  This fresh-history distribution excludes private operator progress and
  historical design-audit records, secrets and restricted implementations.

The original upstream introduction below is retained as attribution/reference.
Its full-product features and historical setup commands do not describe the
RouteVerity baseline.

---

<a href="https://dub.co">
  <img alt="Dub is the modern, open-source link attribution platform for short links, conversion tracking, and affiliate programs." src="https://github.com/user-attachments/assets/42cf0705-f5a2-4200-bc4a-c5acf0ba9e15">
</a>

<h3 align="center">Dub</h3>

<p align="center">
    The open-source link attribution platform.
    <br />
    <a href="https://dub.co"><strong>Learn more »</strong></a>
    <br />
    <br />
    <a href="#introduction"><strong>Introduction</strong></a> ·
    <a href="#tech-stack"><strong>Tech Stack</strong></a> ·
    <a href="#self-hosting"><strong>Self-hosting</strong></a> ·
    <a href="#contributing"><strong>Contributing</strong></a>
</p>

<p align="center">
  <a href="https://twitter.com/dubdotco">
    <img src="https://img.shields.io/twitter/follow/dubdotco?style=flat&label=%40dubdotco&logo=twitter&color=0bf&logoColor=fff" alt="Twitter" />
  </a>
  <a href="https://news.ycombinator.com/item?id=32939407"><img src="https://img.shields.io/badge/Hacker%20News-255-%23FF6600" alt="Hacker News"></a>
  <a href="https://github.com/dubinc/dub/blob/main/LICENSE.md">
    <img src="https://img.shields.io/github/license/dubinc/dub?label=license&logo=github&color=f80&logoColor=fff" alt="License" />
  </a>
</p>

<br/>

## Introduction

Dub is the modern, open-source link attribution platform for [short links](https://dub.co/home), [conversion tracking](https://dub.co/analytics), and [affiliate programs](https://dub.co/partners).

Our platform powers 100M+ clicks and 2M+ links monthly, and is used by world-class marketing teams from companies like Twilio, Buffer, Framer, Perplexity, Vercel, Laravel, and [more](https://dub.co/customers).

## Tech Stack

- [Next.js](https://nextjs.org/) – framework
- [TypeScript](https://www.typescriptlang.org/) – language
- [Tailwind](https://tailwindcss.com/) – CSS
- [Prisma](https://www.prisma.io/) – ORM
- [Upstash](https://upstash.com/) – redis
- [Tinybird](https://tinybird.com/) – analytics
- [PlanetScale](https://planetscale.com/) – database
- [NextAuth.js](https://next-auth.js.org/) – auth
- [BoxyHQ](https://boxyhq.com/enterprise-sso) – SAML/SSO
- [Turborepo](https://turbo.build/repo) – monorepo
- [Stripe](https://stripe.com/) – payments
- [Resend](https://resend.com/) – emails
- [Vercel](https://vercel.com/) – deployments

## Self-Hosting

You can self-host Dub for greater control over your data and design. [Read this guide](https://dub.co/docs/self-hosting/guide) to learn more.

## Contributing

We love our contributors! Here's how you can contribute:

- [Open an issue](https://github.com/dubinc/dub/issues) if you believe you've encountered a bug.
- Follow the [local development guide](https://dub.co/docs/local-development) to get your local dev environment set up.
- Make a [pull request](https://github.com/dubinc/dub/pull) to add new features/make quality-of-life improvements/fix bugs.

### Recommended Versions

| Package | Version  |
| ------- | -------- |
| node    | v22.23.2 |
| pnpm    | 9.15.9   |

### Common Local Development Issues

- `The table <table-name> does not exist in the current database.` - Run `pnpm prisma:push` push the state of the Prisma schema file to the database without using migrations files.
- The project is not building correctly locally - verify your versions of `node` and `pnpm` match the recommended versions above. Delete all `node_modules`, `.next`, and `.turbo` directories in the `apps` and `packages` directory. You may now reinstall `node_modules` by running `pnpm install` and attempt to rebuild the project with `pnpm build`.

### Dev Seed Script

This script seeds the database with development data for testing and development purposes.

**Basic seeding (adds data without deleting existing data):**

```bash
cd apps/web
pnpm run script dev/seed
```

**Truncate database before seeding (deletes all existing data first):**

```bash
cd apps/web
pnpm run script dev/seed --truncate
```

When using `--truncate`, the script will ask for confirmation before deleting any data.

## Repo Activity

![Dub repo activity – generated by Axiom](https://repobeats.axiom.co/api/embed/6ac4c94a89ea20e2e10032b932a128b6d8442e66.svg "Repobeats analytics image")

## License

Dub Technologies, Inc. is a commercial open-source company, which means some parts of this open-source repository require a commercial license. The concept is called "Open Core" where the core technology (99%) is fully open source, licensed under [AGPLv3](https://opensource.org/license/agpl-v3) and the last 1% is covered under a commercial license (["/ee" Enterprise Edition](<https://github.com/dubinc/dub/tree/ee/apps/web/app/(ee)>)) which we believe is entirely relevant for larger organisations that require enterprise features. Enterprise features are built by the core engineering team of Dub Technologies, Inc., which is hired full-time.
