# Open-source compliance preparation

Updated for Milestone 7, 2026-10-07. Source distributions are separate from
production deployments. This is preparation and a release checklist, not a legal
certification or a claim of a hosted production application.

## Working baseline and local export

- The four exclusions in [licensing-exclusions.json](licensing-exclusions.json)
  are unchanged and absent. `pnpm routeverity:licenses` checks their absence,
  restricted imports in the shipped app/shared UI/email, and hosted restricted
  icon references. Sparse patterns have not been weakened.
- [apply-routeverity-exclusions.mjs](../scripts/apply-routeverity-exclusions.mjs)
  applies that inventory to a **clean Git checkout**. It refuses a dirty
  worktree rather than restoring/overwriting in-progress work. The current
  development checkout already has these exclusions.
- [export-routeverity-source.mjs](../scripts/export-routeverity-source.mjs)
  prepares an explicit allowlisted source bundle outside the repository.
  With no argument it performs a dry run. With a new absolute destination it
  copies locally and creates a source-file manifest. It refuses existing
  destinations and never publishes anything.
- Export inputs include the active app, its safe shared helpers, schema,
  permitted workspace packages, pinned dependencies, product tests, generic
  local setup and build/run instructions. The archived upstream app,
  legacy operational/backfill scripts, Git objects, dependencies/build output,
  real environment files, keys, logs and common data-dump formats are omitted.
- Private operator progress and the historical design-audit record are also
  omitted from public exports; neither is required to build or run the source.
- Safe `.env.example` and generic local Compose instructions are included
  because recipients need installation/run information. Private infrastructure
  configuration and actual local generated credentials are not included.
- The product's transparency page describes its OSS foundation. A free source
  download appears in the shared footer on public, authentication and dashboard
  pages, pinned to `v0.1.0-preproduction.20261007` in the fresh-history
  `djhuds2k/routeverity-source` repository. The release tag must exist and its
  archive must match the deployed source before operating a hosted version.
  **Do not deploy first and postpone the source offer.**

Commands from the workspace root:

```powershell
pnpm routeverity:licenses
node .\scripts\export-routeverity-source.mjs
node .\scripts\export-routeverity-source.mjs C:\path\to\a-new-source-directory
```

Review the candidate bundle and dependency notices before distribution. The
export is an allowlist/filter, not a guarantee that arbitrary future additions
contain no secrets; do not store credentials or customer data in source files.

Milestone 1A validation prepared a **700-file** candidate in a new isolated
local directory, restored dependencies with `pnpm install --frozen-lockfile`,
then passed the full product build and 53 web / 3 icon tests plus the exclusion
gate. No real environment file was copied and no live database was used for
that build. The temporary candidate/dependencies were removed afterward;
verification logs and its manifest were retained outside application source.
Nothing was published.

## Asset and modification record

The original geometric RouteVerity PNG logo/wordmark/QR variants and favicon
were copied only from the ownership-confirmed assets in the completed
private design audit. No old implementation,
environment, dependency manifest, migrations or infrastructure was copied.
No SVG or inverse originals were found; none are invented or claimed.
Satoshi's unclear provenance is avoided; the new app uses the already installed
Geist font rather than copying old font files. Its package license/notices must
be retained in the release inventory.

Lucide replacements are permissive ISC artwork, not Nucleo reconstructions.
The existing safe OSS icons remain under their applicable notices. The legacy
partner email illustrations were removed rather than fetched/rehosted.

Independently developed Milestone 1A modifications include the active routing
boundary, verified-email auth configuration, tenant/role-checked workspace/link/
domain/settings actions, standard redirect resolver, domain ownership/type/
suspension fields, RouteVerity branding tokens/layouts, tests and local tooling.
Keep the final revision/date aligned with any future deployed source bundle.

Milestone 2 adds independently developed campaign/policy schema, tenant-checked
configuration CRUD, hostname/UTM validation, optimistic revisions, forms and
acceptance tests. It neither restores upstream campaign/EE behavior nor imports
old RouteVerity implementation code. Existing directory allowlists cover these
new files, including the additive Prisma schema and product tests. No dependency,
restricted asset or source-publication mechanism changed. The current exclusion
gate and export dry run are checked separately; the independently restored
700-file candidate above was a Milestone 1A check, not a newly repeated
Milestone 2 source build.

Milestone 3 independently adds transparent request validation/redirect handling,
credential management, minimal fingerprint audit schema/UI, telemetry and tests.
No restricted tracking/conversion/EE implementation is restored. Directory
allowlists cover the new code/schema/tests; the permitted integrity-monitor
script is now an explicit export input. Issued runtime credentials and audit
records are database/client data, not export inputs. The current source dry run
does not claim a newly isolated source restore/build; repeat that check against
the exact release revision before publication.

## Before operating a modified hosted version

Milestone 7 preparation adds shared, environment-supplied MySQL CA handling for
both Prisma clients and promotes existing unique keys on nine retained schema
models to primary keys for Aiven compatibility. Neither provider credentials nor
its CA certificate are committed/exported. Deployment supplies its own values;
the corresponding source retains the necessary generic configuration logic and
instructions. Product build, exclusion gate and the 761-file source dry run pass.
This is not a new isolated export rebuild or a published corresponding-source
offer. No application deployment has occurred.

Milestone 7 also hardens independently implemented domain mutations with enabled
workspace locking, current-role checks, conditional ownership snapshots and a
bounded TXT resolver. Related tests and honest ownership-versus-hosting UI copy
are included by the existing allowlist. The production build, exclusion gate and
761-file dry run passed before the source-offer change; no new dependency or
private provider data was introduced. The subsequent version-pinned source offer
uses a separate, clean-history repository and omits private operator records.

Milestone 6 independently adds bounded Google request parameters, hash-only
advertising identifier evidence, template generation/local validation UI and
tests. It adds no dependency and does not inspect/import excluded tracking
implementations. Existing directory allowlists cover its source/schema/tests.
Generated bearer templates and audit/source-identifier data remain runtime data,
not source-export inputs. Official public Google documentation is linked rather
than copied as an implementation.

Final Milestone 6 exclusion gate passes and source-export dry run selects
759 files. No new isolated source restore/build or publication was performed.

Milestone 5 independently adds conversion schema, goals/key configuration,
authenticated immutable ingestion, direct click attribution, exact-decimal
reporting and tests. No new dependency or restricted implementation is used.
Directory allowlists include its source/schema/tests and public documentation;
conversion records, references and runtime credentials are not export inputs.
The current dry run selects 753 files; it is not a newly restored source build.

Milestone 4 independently adds minimal analytics capture, enrichment scanner,
tenant-scoped reporting/detail/CSV and tests. No dependency was installed.
The scanner reuses Next's bundled MIT `ua-parser-js` through its public
`userAgentFromString` helper; preserve the installed package's notices.
The new CLI scanner is an explicit source-export input, and directory allowlists
cover all reporting/schema/tests. Database events, raw/pending UA input and CSV
downloads are runtime data and are not selected by the source exporter.
The retained EE-coupled upstream job framework is not activated.

1. Preserve [LICENSE.md](../LICENSE.md), upstream copyright, attribution and
   warranty notices; preserve third-party notices in the shipped artifacts.
2. Record modifications and dates, with a reproducible deployment/source revision.
3. Provide a prominent, free corresponding-source offer to all remote users of
   the modified AGPL application, as required by section 13. Include access from
   public tracking/transparency surfaces, not only a privileged dashboard.
4. Make the source match the deployed version, including necessary build,
   dependency, installation and run scripts. An unmodified Dub link is not enough.
5. Export only legally distributable content. Apply
   [licensing-exclusions.json](licensing-exclusions.json) and remove dependencies
   on excluded content before releasing a functioning OSS source bundle.
6. Do not publish raw upstream Git objects containing restricted trees as if
   they were AGPL-only. Prepare a source export/release process.
7. Exclude secrets, environment files, customer data and private operational
   configuration. Supply safe example configuration and documented setup instead.
8. Verify the actual dependency bundle's notices, fonts/assets and LGPL/MPL or
   other applicable source obligations. Retain license texts.
9. Have qualified counsel review uncertain licensing and combined-work questions.

Commercial charging does not remove AGPL obligations. A source offer does not
grant permission to redistribute proprietary Dub or Nucleo material.
The provisionally specified company identity is not verification of incorporation.
RouteVerity's central brand configuration initializes certification status to
`NOT_SUBMITTED`. No certification submission, approval or claimed endorsement
exists.

## Remaining release concerns

- Root AGPL text versus package `AGPL-3.0-or-later` declarations remains a legal
  review item; notices have not been rewritten to erase that distinction.
- The full installed monorepo retains unused upstream packages/dependencies.
  Verify the **actual deployed dependency bundle** and corresponding notices,
  not only top-level manifest labels, before production/source publication.
- Restricted objects still exist in upstream Git history. A source export is
  not permission to publish that raw history.
- Production SMTP, TLS, domain hosting, backups, source-offer URL and release
  revision tracking are deployment prerequisites, not claims made by this
  working local baseline.
