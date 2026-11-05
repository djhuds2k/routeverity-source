# RouteVerity local baseline services

Milestone 5 validation passes all 17 production browser scenarios, including
four independent conversion scenarios, and 311 web tests plus 3 icon assertions.
Conversions need no additional service or queue. Apply the additive schema with
the existing `pnpm --filter web prisma:push`, never a data-loss bypass.
See [conversion integration](conversions.md) for keys, direct click attribution,
exact revenue, immutable retries and fixture cleanup.

Milestone 6 adds a nullable Google metadata column to the existing redirect
record. Stop the app before Prisma push/generation on Windows, then rebuild and
restart. No new dependencies, queue, external Google account or local services
are needed. The campaign Google setup tool validates saved policies without
contacting Google or landing pages. See [Google Ads](google-ads.md) for templates,
privacy, single-encoding preview and the explicit live-verification boundary.

Final Milestone 6 checks pass all 19 production browser/HTTP scenarios and
360 web tests plus 3 icon assertions. Use the same product test/build commands;
no upstream suite or live Google-account verification is implied.

Milestone 7 promotes existing unique keys to primary keys on nine retained
models, preserving their fields and compound selectors. Aiven requires every
table to have a primary key; do not disable that safeguard. Stop the app before
local Prisma push/generation, apply with the existing command without a data-loss
override, then rebuild. The local schema sync passes with existing data.

Hosted MySQL supplies `ROUTEVERITY_DATABASE_CA` as a multiline PEM environment
value alongside its restricted runtime `DATABASE_URL`. Both the product and
NextAuth Prisma clients materialize that public CA into an ephemeral writable
temporary directory and require `sslaccept=strict`. Invalid certificates,
unsupported connection inputs and filesystem errors fail explicitly. Without
the CA variable, the existing local connection configuration is unchanged.
Do not copy hosted credentials into the local environment or commit a provider
CA/connection string. Schema installation uses a separate administrator
credential; the runtime user has only SELECT/INSERT/UPDATE/DELETE on the dedicated
application database.

Vercel builds use `apps/web` as the project root and Node 22.x. The active
`apps/web/vercel.json` restores the frozen pnpm lockfile and invokes
`pnpm --workspace-root routeverity:build`, building the shared packages before
Next.js. Next's output-file tracing root is the workspace root so runtime
dependencies outside the web directory can be included. Keep access to source
files outside the project root enabled in the hosting settings. Do not use the
archived upstream configuration or deploy the original working Git history.
Local validation of this command is not hosted deployment acceptance.

## Worker health and optional email

Apply the additive worker-health schema to the dedicated local database with
the existing Prisma push command, stopping the app first on Windows. Rebuild
before restarting. The current local schema has 96 tables; the prepared
production schema still has 94 and has not received these safety changes.

```powershell
pnpm routeverity:health
# Structured logs every minute, still no email:
pnpm routeverity:health --watch
# Only after privately setting ROUTEVERITY_ALERT_EMAIL:
pnpm routeverity:health --watch --notify
```

The CLI checks actual MySQL/Redis, latest enrichment/retention progress,
successful integrity scans and expiry/enrichment backlogs. Missing or stale
workers are unhealthy even with no pending work. Run enrichment and applying
retention with their existing watch commands, and schedule integrity scans
more frequently than ten minutes. Run only one instance of each named worker;
a newer run supersedes older heartbeat writes. Read-only retention previews
do not masquerade as successful cleanup.

Notifications reuse the existing SMTP server/from configuration; no new mail
provider or dependencies are needed. The example environment contains no
recipient. Local integration tests require loopback SMTP port 11025 and fake
recipients only; run `pnpm --filter web test:e2e:routeverity worker-health.spec.ts`
without watching workers. Those tests restore prior idle heartbeat snapshots
only if their own run still owns the row, and refuse a recently running worker.
The operator profile also verifies the protected health heading.

The monitor is not automatically hosted or started with the app. It cannot
detect its own outage without an external dead-man service. Hourly accepted
incident cooldown is per process, recovery follows an accepted incident, and
restarts can repeat mail. SMTP acceptance is not inbox verification. See
[failure modes](failure-modes.md) for exact thresholds and deadline semantics.

## Local operator safety profile

`ROUTEVERITY_OPERATOR_EMAIL` optionally enables one operator identity. An unset
value disables access; an invalid value fails explicitly. The current database
account must match the configured email and have a non-null email-verification
timestamp. Workspace membership alone never grants operator access. Supply a real
operator address privately, not in source or the example environment.

Apply the additive operator-audit schema to the isolated local database with
`pnpm --filter web prisma:push`, without a data-loss override, then rebuild.
`/operations` supports reason-required workspace suspension/resumption, with an
optimistic workspace revision and a current-identity recheck after locking.
The state change and append-only application audit insert share one transaction;
audit failure rolls back the change. Events retain actor/workspace IDs, operation,
reason, before/after flags and time, not email addresses or credentials. There is
no application edit/delete interface for audit events; this is not a claim of
database-enforced immutable storage. The independent retention worker now expires
operator audits after 365 days; supervised scheduling remains a release gate.

Suspension blocks subsequent workspace access and tracking-policy lookups;
already authorized in-flight requests may finish. Resumption does not restore
revoked credentials or independently suspended campaigns/domains.

The privileged browser scenario is opt-in and runs only against the dedicated
local SQL/SMTP services. Set `ROUTEVERITY_OPERATOR_EMAIL=operator-e2e@routeverity.test`
on both the local server and runner, then run
`pnpm --filter web test:e2e:routeverity operators.spec.ts`. It verifies ordinary
member denial, live verification revocation, suspension/access/redirect gating,
resumption and exact audit evidence, and cleans only its own fixtures. Without
that dedicated profile it is explicitly skipped, not reported as a successful
operator test. Restore the server's intended operator configuration afterward.
No production audit schema or operator identity is configured by these steps.

This development-only stack is isolated from all existing containers. It uses
Compose project `routeverity-baseline`, network `routeverity-baseline-network`,
and volumes `routeverity-baseline-mysql-data` and
`routeverity-baseline-redis-data`. No shared MySQL, Supabase or MongoDB instance
is used, inspected, stopped or reconfigured.

## Requirements and commands

Use Docker Desktop with a running Linux-container daemon, Docker Compose, Git
(optional for a sanitized source archive without repository metadata),
and the repository-pinned Node.js 22.23.2 (`22.x` engine). From
`D:\Companies\routeveritynew`, PowerShell:

After a Windows reinstall, verify these tools rather than assuming restored
tasks still work. Corepack can resolve the pinned pnpm version, but nested
repository scripts also need `pnpm` on PATH. Check for existing dedicated Docker
volumes/backups before starting replacement services. Preserve the ignored local
environment and its passwords; restoring source/dependencies does not restore
database data. The Playwright package also needs its matching Chromium runtime.
Do not use production credentials or a shared database to bypass local failures.

Use a short checkout path on Windows, such as `C:\src\routeverity`. Deep checkout
paths combined with pnpm's dependency paths can prevent Node from resolving
package imports even when the package files exist.

```powershell
fnm env --shell powershell | Out-String | Invoke-Expression
fnm use 22
node .\scripts\local-routeverity.mjs setup
node .\scripts\local-routeverity.mjs start
node .\scripts\local-routeverity.mjs health
node .\scripts\local-routeverity.mjs status
```

`setup` generates random database passwords, NextAuth secret and Redis REST
token in **ignored** `apps\web\.env.local`. It refuses a tracked file or an
existing file not generated by this helper; it never overwrites an existing
baseline file. Keep this file private. File mode is `0600` where supported;
on Windows, also use an appropriately private NTFS directory/user account.
In a Git-free source archive it verifies the included local-env ignore rule;
inside a Git worktree it still rejects a tracked/non-ignored environment.
Do not regenerate database passwords after initializing the MySQL volume:
MySQL initialization variables do not update existing database users.

`start` includes setup, validates Compose, starts only this project's five
services and waits for readiness before running functional health checks.
Commands suppress Docker output that could contain interpolated credentials.
No schema push, migration, seed or application startup occurs.
Repeated setup/start/health commands preserve credentials and database data.

`health` checks container ownership, exact loopback bindings, dedicated storage
and network, authenticated MySQL `SELECT DATABASE(), 1`, authenticated
PlanetScale HTTP `SELECT 1`, Redis REST `PING` and missing-token rejection,
SMTP greeting/EHLO/QUIT, and MailHog's message API/UI. It changes no SQL schema
or Redis keys and sends no email. `status` checks containers and isolation only.
The SQL proxy image has no native container health check; its authenticated
SQL readiness is checked by the helper. The other four services have Compose
health checks.

To stop **only this stack**, while preserving its volumes:

```powershell
node .\scripts\local-routeverity.mjs stop
```

Do not run unscoped `docker compose`, global Docker cleanup/prune commands,
or commands targeting existing shared services. Avoid `docker compose config`
(without `--quiet`), dumping `.env.local`, or inspecting container environment
variables in shared terminal logs: those can expose passwords.

## Endpoints and environment

| Service                               | Host endpoint                                  | Storage                       |
| ------------------------------------- | ---------------------------------------------- | ----------------------------- |
| MySQL 8.0.46                          | `127.0.0.1:13306`, database/user `routeverity` | Dedicated MySQL volume        |
| PlanetScale-compatible SQL HTTP proxy | `http://127.0.0.1:13900`                       | Uses only the dedicated MySQL |
| Redis REST                            | `http://127.0.0.1:18079`                       | Dedicated Redis AOF volume    |
| MailHog SMTP                          | `smtp://127.0.0.1:11025`                       | In-memory email only          |
| MailHog UI                            | <http://127.0.0.1:18025>                       | In-memory email only          |

Redis's native port is not published. All published ports are bound to IPv4
loopback. The dedicated Docker bridge network is not shared with other
projects. It is not marked `internal`: this Docker daemon suppresses host
port publishing on internal-only networks. Containers can reach outbound
networks; never use MailHog's "release" feature to send real mail.
MailHog messages are discarded on container restart; no MongoDB is used.
MailHog's unauthenticated UI/SMTP and internal Redis are development-only.
Anyone with local machine or Docker access can read local credentials/data.

The generated file provides `DATABASE_URL`, `NEXTAUTH_URL` (fixed to
`http://localhost:8888`), `NEXTAUTH_SECRET`, `EMAIL_SERVER`, `EMAIL_FROM`,
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and
`PLANETSCALE_DATABASE_URL`; the two `ROUTEVERITY_MYSQL_*` variables are
Compose-only initialization credentials.

The active RouteVerity app consumes these settings; this is not a full upstream
environment. The SQL adapter uses the PlanetScale SDK's `{ url }` option to
retain HTTP locally, and verified-email authentication consumes `EMAIL_SERVER`
and `EMAIL_FROM`. Start the application separately as described below. Cloud
analytics, billing and queues are not provisioned or needed for the baseline.

## Upstream sources, licenses and image pinning

All five images are pinned by immutable registry SHA-256 digest in
`docker-compose.routeverity.yml`. MySQL, Redis and MailHog additionally have
version tags. The proxy digests resolve their upstream published `latest`
images at baseline setup time; later tag changes do not silently update them.
No upstream source is copied into the application.

| Component              | Public source and license                                                                                                                             | Notes                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MySQL Community 8.0.46 | [Source](https://github.com/mysql/mysql-server/tree/8.0), [GPLv2 with additional permissions](https://github.com/mysql/mysql-server/blob/8.0/LICENSE) | Official `mysql` image. Separate server process; not bundled app code.                                                                                           |
| ps-http-sim            | [Source/usage](https://github.com/mattrobenolt/ps-http-sim), [MIT](https://github.com/mattrobenolt/ps-http-sim/blob/main/LICENSE)                     | Published `ghcr.io/mattrobenolt/ps-http-sim`; unofficial development-only PlanetScale compatibility layer.                                                       |
| Redis 7.2.4            | [Versioned source](https://github.com/redis/redis/tree/7.2.4), [BSD-3-Clause](https://github.com/redis/redis/blob/7.2.4/COPYING)                      | Deliberately pinned before later license changes, not Redis Stack or a newer Redis release.                                                                      |
| serverless-redis-http  | [Source/usage](https://github.com/hiett/serverless-redis-http), [MIT](https://github.com/hiett/serverless-redis-http/blob/master/LICENSE)             | `hiett/serverless-redis-http`, token-authenticated Upstash-compatible body-based REST; pipeline/transaction support. Not path-command or query-token compatible. |
| MailHog 1.0.1          | [Source](https://github.com/mailhog/MailHog), [MIT](https://github.com/mailhog/MailHog/blob/master/LICENSE.md)                                        | Published `mailhog/mailhog:v1.0.1`; mail capture only.                                                                                                           |

License sources were checked on 2026-10-06. This is a local service inventory,
not permission to redistribute an image without its applicable notices/source
obligations or a legal opinion on the application's licensing. Redis 7.2.4 and
MailHog 1.0.1 are older local-test pins, not recommendations for production
security. Review image updates and compatibility deliberately; do not expose
these services publicly.

# RouteVerity product validation

The active app is intentionally separate from non-shipping upstream references.
After service setup and schema push, build shared packages and the product:

Milestones 2/3/4 add independent campaign/policy tables, tracking credential hashes,
redirect audit and bounded pending analytics metadata. On the
isolated local database, apply the additive schema before starting the app:

```powershell
pnpm --filter web prisma:push
```

This generates the Prisma client as well. Stop this workspace's application
server first on Windows: an open Prisma engine DLL can otherwise cause `EPERM`.
Do not use `--accept-data-loss`, run upstream seeds, or target shared databases.
Production migration/rollout procedures remain a separate release task.

### Existing local worker enum: P2-B schema addition

P2-B adds merchant submission/retry tables and the MERCHANT_RECONCILIATION worker
name. Fresh databases get the complete enum during normal schema push. On an
existing MySQL installation, Prisma can flag the enum widening as a primary-key
change. **Do not use a data-loss override.** For the isolated local database,
review and apply this additive enum widening before normal schema push:

```sql
ALTER TABLE `RouteVerityWorkerHealth`
  MODIFY COLUMN `name`
  ENUM('ENRICHMENT','RETENTION','INTEGRITY','MERCHANT_RECONCILIATION') NOT NULL;
```

On 2026-10-17 this exact operation was guarded to loopback MySQL port 13306 and
database routeverity, and existing worker rows and the name primary key were
compared before/after. Normal Prisma schema sync then succeeded without forcing
data loss. This is not a production migration approval or a general instruction
to alter arbitrary/shared databases. Production migration/rollback needs review.

After the normal production build, the merchant scanner can run one bounded
pass with `pnpm routeverity:reconcile-merchants`; `--watch` repeats once per
minute. Due no-match events are rescheduled five minutes apart, until the
24-hour receipt-based eligibility deadline. Supervise it separately from
enrichment, retention and health monitoring.

P2-B passes 594 web tests, three icons, typecheck, scoped lint, licensing,
production build and **all 37 local E2E scenarios** with no skips. The actual
one-pass merchant CLI and its persisted success heartbeat were checked.
Initial Windows OS error 5 launches were followed by a stalled run against a
remaining orphan acceptance child; after identifying/stopping that exact owned
PID, a clean server with file-backed logs passed the complete suite. No security
settings were changed or alternate executor used. When stopping an acceptance
session, also verify that its listener is gone before restoring normal service;
never kill by process name or stop an unidentified listener.

### Independent source-build checks

A sanitized source export intentionally has no real environment file. After a
frozen-lockfile dependency restore, a build still needs valid authentication and
service configuration names; a completely empty environment fails explicitly.
For a build-only check, supply the following disposable values in that
PowerShell process, not in an exported file:

```powershell
$env:NEXTAUTH_URL = "http://localhost:8888"
$env:NEXTAUTH_SECRET = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
$env:EMAIL_SERVER = "smtp://127.0.0.1:1"
$env:EMAIL_FROM = "RouteVerity Build <build@routeverity.test>"
$env:DATABASE_URL = "mysql://build:unused@127.0.0.1:1/routeverity_build"
$env:UPSTASH_REDIS_REST_URL = "http://127.0.0.1:1"
$env:UPSTASH_REDIS_REST_TOKEN = [guid]::NewGuid().ToString("N")
pnpm routeverity:build
```

These unused loopback service ports and ephemeral values are only for building,
not starting an app or running database/browser acceptance. Close that shell
afterward. Do not reuse production credentials or copy a private environment
file to make a source candidate build. Functional acceptance requires the
documented isolated services and their real local configuration.

### Product checks with local services

```powershell
pnpm routeverity:licenses
pnpm routeverity:build
pnpm routeverity:typecheck
pnpm routeverity:lint
pnpm routeverity:test
pnpm routeverity:start
```

The server binds only `127.0.0.1:8888`; use `http://localhost:8888` for consistent
authentication cookies and callbacks. For development use `pnpm routeverity:dev`
instead of the production start command. Do not run build and dev concurrently
against the same `.next` output.

With the app and local services running:

```powershell
pnpm routeverity:e2e
```

This browser test creates a unique `.test` account using a **real local SMTP
message and single-use verification link**, then exercises workspace creation,
navigation, link creation/redirect, domain suspension/resumption/deletion guards,
failed DNS verification, settings, logout and login again. It cleans up only
its own unique records and refuses any database except the isolated local
`routeverity` database on port 13306. It does not require Google/Stripe/Tinybird/
QStash credentials. If Playwright reports a missing Chromium executable, run
`pnpm --filter web exec playwright install chromium`, then retry.

Web tests preserve the four previously passing OSS test files and add input,
tenant/role, free-limit and redirect-state regressions. The product test command
also runs the icon-migration assertions (requires the preceding package build).
The editor's test tool did not discover these tests; the documented CLI runner
is authoritative.

The additional browser checks cover foreign-workspace denial, viewer-only
surfaces and mobile public/login layout/logo rendering. The suite now has
**13 verified Milestone 4 production scenarios**, including campaign lifecycle/policy/readiness,
invalid-save preservation, optimistic stale edits after preview refresh,
archive/deletion and foreign-tenant/viewer/mobile campaign access. Campaign
tests explicitly mark only their own local domain fixture verified; this does
not claim real positive DNS verification. Every fixture is cleaned up.

For `/click`, loopback HTTP requests supply the synthetic fixture's Host header.
There is no local HTTP destination exception: next hops still require HTTPS.
Tests stop at the 302 and never fetch third-party landing pages. Host/domain
binding, identical crawler/browser targets, IDNA/Unicode encoding, credential
rotation/revocation, malformed/duplicate input, suspension, durable fingerprints,
mobile audit layout and negative integrity monitoring are covered.

Run `pnpm routeverity:redirect-audit` to inspect persisted target-integrity
violations (nonzero on mismatch or dependency failure). Hosting/alert scheduling
is not set up locally. See [redirect behavior](transparent-redirect.md),
[failure modes](failure-modes.md) and [measured load](redirect-performance.md).

After applying the schema, drain enrichment separately from the web server:

```powershell
pnpm routeverity:enrich-clicks
# Or in a separate terminal; stop with Ctrl+C:
pnpm routeverity:enrich-clicks --watch
```

No QStash/Tinybird service or public worker route is required. Device/browser/OS
reporting remains pending until the scanner runs; successful enrichment deletes
raw user-agent input. Reports/export do not expose that raw input. The scanner
exits nonzero on failure and can be retried without duplicate events.
Do not run a continuously watching scanner alongside fixture acceptance tests:
those deliberately assert pending state before draining their own events.
See [click analytics](click-analytics.md) for privacy, UTC filters, CSV limits
and supervised-worker/retention release requirements.

### Approved data retention

Owners can choose 30, 60 or 90 days in workspace Settings. The default and maximum
is 90 days. Shortening requires confirmation and a current policy snapshot;
ownership and enabled workspace state are rechecked inside the mutation.

After synchronizing the additive local schema, preview eligible batches:

```powershell
pnpm routeverity:retain-data
```

This is read-only and reports **at most 100** candidate records of each type per
workspace, not full-database totals. For actual local cleanup:

```powershell
pnpm routeverity:retain-data --apply
# Separate attached terminal; stop with Ctrl+C:
pnpm routeverity:retain-data --apply --watch
```

Apply drains bounded batches; watch repeats passes with a 60-second idle wait.
The worker uses the configured database and can irreversibly delete evidence.
Do not point it at production without approving the schema, schedule and expiry
monitoring. This milestone ran only scoped, owned local fixtures with apply;
no production cleanup or migration was performed.

Click/redirect evidence expires from creation; conversion events and retry
receipts expire from conversion receipt. Pending raw user agents are erased at
24 hours by the independent cleanup worker even if enrichment is stopped;
enrichment also refuses to parse expired raw input. Operator audit evidence
expires separately after 365 days. Worker downtime can delay physical erasure;
supervised hosting and alerts are not configured yet. Account/workspace deletion
and provider backup/log retention are not supplied by this worker.

Run `pnpm --filter web test:e2e:routeverity retention.spec.ts` against the dedicated
local database and SMTP services. It validates SQL cutoff boundaries, bounded
receipt cleanup, idempotent reruns, owner confirmation/stale forms, role denial,
CSV/detail expiry and retained-only overview metrics. It scopes global-policy
checks to its own workspace and cleans only its own fixtures. Do not run
continuously watching cleanup/enrichment processes alongside fixture tests.
See [privacy and retention](privacy.md).

### Account and workspace deletion

Open `/account` from the workspace list or Settings. Owners can delete active
or suspended workspaces by typing the exact address and confirming permanent
erasure. A current workspace revision and ownership are rechecked in the
transaction. Operator incident history remains for its 365-day policy.

Account deletion requires no owned workspaces, the exact current verified
email and explicit confirmation. Live sessions/login tokens and memberships
are removed; shared workspaces/links remain, with deleted link author IDs
cleared. Ownership transfer is not available. These are live-database actions,
not deletion of external DNS, provider backups/logs or downloaded exports.

Run `pnpm --filter web test:e2e:routeverity deletion.spec.ts` against the
dedicated local SQL/SMTP profile. The spec uses nonce users/workspaces only and
tests scoped erasure, stale/exact confirmations, concurrent late clicks,
operator-evidence retention, revoked sessions, preserved shared links and
suspended workspace deletion. Cleanup removes only its owned fixtures.
No production migration or deletion is required by this feature.

### Account and owner workspace JSON export

The Account page provides personal JSON export and links to each owned workspace
export, including suspended workspaces. Settings provides the owner-only full
workspace download; existing filtered click CSV access is unchanged.

Exports contain retained active-product data only, use repeatable-read snapshots
and declare `routeverity-export-v1`. Credential fields, raw user-agent input and
operator incident history are excluded. Workspace memberships use random user
IDs, not other members' email addresses. Personal export includes non-secret
session/provider metadata and authored-link references, not full shared content.
Dates are UTC and revenue is an exact decimal string.

Each collection is limited to 10,000 rows and the complete UTF-8 JSON to 20 MiB.
Overflow produces 413 with no partial file; larger export fulfilment is not
implemented. No query filters are accepted. Per-user rate limit is ten combined
account/workspace JSON exports per minute. Keep downloaded files private.

Run `pnpm --filter web test:e2e:routeverity data-export.spec.ts` against the
dedicated local SQL/SMTP profile. It verifies a real browser attachment,
51-record complete scope beyond reporting pagination, exact three-decimal
revenue, historical campaign evidence, credential/raw-input exclusion, account
scope, member/foreign/anonymous denial, unchanged member CSV and suspended-owner
export. Unit tests verify every collection's 10,000/10,001 boundary and exact
20 MiB UTF-8 framing limit. Fixtures remove only their own SQL records.
No external storage service or production export is used.

Node is pinned to **22.23.2** in `.node-version` and `.nvmrc`. With installed fnm:

```powershell
fnm env --shell powershell | Out-String | Invoke-Expression
fnm use 22.23.2
```

Milestone 0's Node 24 run passed targeted tests; the missing icons, EE coupling
and lint configuration failures were not proven to be Node 24 defects. Node 22
is the supported installed LTS common to Next/Vite/Vitest; the old Node 23
recommendation is outside Vitest's supported major list.

Authentication is intentionally verified email signup/sign-in, not the old
password/SSO onboarding. Open `/login` or `/signup`, enter your own local test
email and open its message in MailHog. Do not use real customer addresses in
the local inbox. Existing source-only upstream setup/seed/deployment commands
are not product startup instructions.
