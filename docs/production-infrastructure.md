# Production infrastructure preparation

## Candidate15 source selection - E199, 1 November 2026

Use the Candidate15 external E199 source/configuration and actual execution
record when selecting this source. The Candidate14 baseline and older findings
below are predecessor evidence; they do not establish Candidate15 or hosted
acceptance. This source removes unsupported install inputs, retains the scoped
Next/privacy repairs and uses the same filtered install/build contract.
Account/domain/TLS/billing/settings and provider/worker/privacy acceptance
still require the existing read-only inspection and exact approved changes.

## Current local baseline and historical findings

Candidate14 is the current independently restored local baseline (E193):
721tests and configured fresh-ZIP Linux build/types/lint/native/HTTP/notices
checks pass. The E189 request-error/mutation logging correction and E190
filtered install command are included. The older E188 findings/tables below
are dated history; they do not mean those local corrections remain undone.
Provider log privacy, effective settings, accounts, domains, costs and hosted
acceptance remain unverified. Four native/marker acceptance issues remain.
Subsequent local proposals are preparation, not infrastructure execution.

## E190 repository install configuration corrected

The new candidate13 vercel.json uses
`pnpm --filter dub-monorepo --filter web... install --frozen-lockfile --ignore-scripts`.
The existing root build command remains unchanged and explicitly generates Prisma
inside the web build. The prior unfiltered-file discrepancy in E188 is historical
for earlier candidates. Execute both actual JSON commands from apps/web in a
fresh source restoration, without pre-generating clients; exact results belong
in private E190 evidence. Application/dependency/notice bytes remain candidate12.

Effective live dashboard overrides, project root/workspace access, Node patch,
pnpm, domains/TLS/security rules/egress and billing still require authenticated
read-only inspection. Repository alignment alone does not change or verify them.
No Vercel connection is available here; no deployment/configuration write occurred.

## E189 local correction supersedes the E188 telemetry finding

The new candidate12 source replaces the unsafe framework hook and raw mutation
error output with bounded event/type/incident-ID telemetry, without request data
or raw errors. Actual repository focused regressions and typecheck pass; final
candidate12 build/restoration evidence is private E189 release evidence. E188's
later sections describe the predecessor and remain valid as historical findings,
not a claim that the correction is already hosted. Provider runtime/request/log-
drain privacy remains unverified. All live infrastructure remains read-only and
account-dependent checks BLOCKED; no staging or runbook execution occurred.

E188 / P4-A, 31 October 2026. **IN_PROGRESS**. Live account inspection is
**BLOCKED** by missing access in this session. This milestone authorises public
and authenticated read-only inspection, not deployment, DNS, source publication,
paid provisioning, production writes or worker activation. Existing application,
branding and candidate10 are preserved. This is supporting evidence for the
existing completion programme, not another master plan.

## Evidence and account access

Three evidence classes are kept separate:

| Evidence | Status and provenance |
| --- | --- |
| User-supplied independent Vercel check, 31October2026 | Accepted as supplied evidence; not a fresh authenticated inspection by this session |
| Public DNS, verified TLS, root HEAD/GET, source/lock/archive comparison and synthetic logging probe | VERIFIED_COMPLETE for their bounded scope; private E188 evidence retains timestamps, certificate fingerprints, request IDs and checksums |
| Current deployments/history/aliases, firewall logs, billing eligibility, environment-variable presence and runtime/build logs | BLOCKED: no connected provider tools, CLI authentication, linked-project file or browser session available |

The Vercel plugin catalog reports the integration uninstalled in this session;
the browser has only about:blank. No VERCEL/NOW credential environment names,
Vercel CLI executable, conventional CLI auth-file locations or local project link
were found. This does not contradict a connection available in another session.
No token, auth-file content, hosted environment values or customer logs were read.

Connection procedure: connect the existing Vercel integration to this session
using the existing account/team, or install/authenticate the official CLI locally
through its browser sign-in (`vercel login`). Never paste an API token here.
After connection, check identity/team and inspect the exact existing project;
do not run link/create/deploy/pull-env commands. See [official CLI login](https://vercel.com/docs/cli/login).
Hold account modifications until the read-only results and corrective proposal
are reviewed. Separate `routeverity-holding` and `routeverity-shopify` projects
must remain untouched.

## Correct project and deployment identity

User-supplied independent findings:

| Field | Supplied result |
| --- | --- |
| Team | Danny's projects — team_ozbSlzVjSbUAT13N7lLmFAET |
| Intended existing project | routeverity — prj_pk6HRaTqMD079UMHUAi3hsDylDMB |
| Framework / Node | Next.js /22.x |
| Recorded production deployment | dpl_FhQYu2NL8twfh6mXZnx9omYCeF41, READY |
| Recorded repository / commit | djhuds2k/routeverity / a80d7cb295269ab75af5249861b7aae575334461 |
| Recorded production region | iad1 |
| Deployment protection | Enabled for deployment URLs, custom domains excluded |

READY is a deployment-build status, not evidence that requests succeed, account
billing permits another build, workers run, or this deployment matches candidate10.
Latest preview/history, deployment timestamp, aliases, effective settings, pause
state, quotas, payment restrictions and current eligibility remain BLOCKED.
No old commit is a substitute for the selected source archive. This checkout's
HEAD/remote still identify upstream Dub rather than the uncommitted product;
never push this tree to that upstream remote or redeploy the recorded old commit.

## Domain, TLS and response diagnosis

Observed31October2026 around11:53UTC, using standard certificate verification,
normal root HEAD/GET without redirects, cookies, tracking queries or bypasses:

| Host | DNS A | TLS issuer / expiry UTC | Response |
| --- | --- | --- | --- |
| routeverity.com | 76.76.21.21 | Let's Encrypt YR1 /2January2027 01:52:55 | 403, X-Vercel-Mitigated:deny |
| www.routeverity.com | 76.76.21.21 | Let's Encrypt YR2 /31December2026 22:48:02 | 403, X-Vercel-Mitigated:deny |
| click.routeverity.com | 76.76.21.21 | Let's Encrypt YR1 /21January2027 16:21:32 | 403, X-Vercel-Mitigated:deny |
| app.routeverity.com | 76.76.21.21 | Let's Encrypt YR2 /1November2026 14:19:57 | 404, X-Vercel-Error:DEPLOYMENT_NOT_FOUND |

Each presented certificate covers its exact hostname and currently validates;
TLS1.3 succeeds. The app expiry remains the same observed expiry as E187, not a
confirmed renewal. This is urgent to inspect but not an established TLS outage.
Public DNS resolver also reports Cloudflare nameservers, no CNAME/AAAA/CAA answer
for these queried names, Migadu MX/SPF, and DMARC quarantine. NODATA does not
prove DNSSEC validation or all DNS views; raw resolver status/answers are retained.
The legacy Vercel A target is reachable; only account configuration can establish
the currently required project-specific target. No DNS mismatch is proven.

Vercel normally attempts automatic renewal14–30days before expiry. Actual
domain attachment, certificate type, validation events, retry/pending state and
renewal settings cannot be inferred from that default. Inspect the account's
certificate/domain history now; do not issue a replacement or change DNS from
this observation. [Vercel certificate policy](https://vercel.com/docs/domains/working-with-ssl).

| Symptom | Supported diagnosis | Still unresolved / recommended read-only check |
| --- | --- | --- |
| App404 | Vercel cannot resolve a deployment for this request; provider DEPLOYMENT_NOT_FOUND header/body agree. This is not a demonstrated Next.js route/auth failure | Supplied project-domain listing excludes app and direct lookup404 despite broad metadata. Search authorised team domain/alias records for this exact hostname and compare deployment aliases/deletion history. Detached/stale metadata is plausible; another project/team, deletion or deliberate unused hostname is not excluded |
| Apex/www/click403 | Responses carry provider mitigation deny metadata, supporting an edge/security denial; no app origin execution is demonstrated | Correlate saved request IDs/timestamps with firewall events, rules and account restrictions. Inspect effective custom-domain protection exclusions and current deployment/alias state. Do not label a specific WAF rule, pause or billing restriction as the cause without evidence |
| www intended308 | Supplied configuration says redirect to apex, but edge403 prevents observing it here | Verify assignment/redirect metadata read-only; after any separately approved correction, check one-hop308 and destination without altering apex |

[Vercel DEPLOYMENT_NOT_FOUND reference](https://vercel.com/docs/errors/deployment_not_found).
These observations are from this audit environment; no worldwide outage is
claimed. Exact proposed corrections are conditional: if app is intended and
confirmed unbound, propose adding it to the existing project and approved
release; if deliberately unused, keep it unused and remove it from the proposed
canonical map only by owner decision. If an overbroad rule is proven, propose
the narrowest host/path/rule change with security acceptance; do not disable
the firewall or deployment protection globally. Account restrictions require the
owner's billing/support decision, never an automatic upgrade.

## Candidate10 and effective hosted-build comparison

Candidate10 remains immutable:857source files plus manifest,858entries.
ZIP SHA256 `93a082377a2c8a71161369a1242c1aea2d2b3cda5c01f9606d1bc6eb5580eb9f`;
selected-source revision `0b37c2ad73869c0ac08f137c272dd1c5a53c753bdca90d5c24c0346dbfaa907d`;
lockfile SHA256 `e7f571cc1445545042387b1055a59e97144a59624efbebe3d20e3ffe3900c5e8`.
Archive and every selected working-source hash were rechecked before P4 docs.
E187's actual-ZIP isolated Linux build/types/lint/boundary/702tests/native/HTTP/
notice acceptance remains its evidence; no expensive candidate10 rerun occurred.

| Setting | Candidate10 expected / verified | Supplied/live evidence and required action |
| --- | --- | --- |
| Source | Matching sanitized archive/manifest and pinned lock; Next15.5.28/React19 | Recorded production a80d7cb is different; cannot reproduce candidate10 by redeploying it |
| Root | Monorepo sources visible, app apps/web, shared packages available | Actual root and include-outside-root setting BLOCKED; propose apps/web root with workspace access |
| Node | Exact22.23.2 for independent restoration | Supplied22.x matches major only; record actual hosted build/runtime patch, then accept/test any difference rather than asserting exact pin support |
| pnpm | Exact9.15.9 via root packageManager/toolchain | Hosted version BLOCKED; inspect build logs without raw secret-containing output |
| Install | `pnpm --filter dub-monorepo --filter web... install --frozen-lockfile --ignore-scripts` | Stored vercel.json says unfiltered `pnpm install --frozen-lockfile`; dashboard override unknown. Broader legacy packages/lifecycle scripts differ from accepted installation. Propose the tested filtered command before an authorised hosted build |
| Build | `pnpm --workspace-root routeverity:build`; explicit Prisma generation, Next patch guard, shared UI build | Stored build command agrees; actual effective dashboard command BLOCKED. Do not append db push/migrations |
| Runtime | Node.js dynamic click/conversion handlers, native Prisma/Sharp; single accepted region near SQL | iad1 supplied, no region/function limits in source config; actual duration/memory/concurrency/egress BLOCKED. Choose region only after DB location/latency review |
| Notices/source | Generated/served notices match; historical footer intentionally unchanged | Four provenance/conveyance gaps plus logging finding block release acceptance; new approved matching publication required before hosting |

Dashboard/file overrides and actual function output must be compared, not assumed
from source alone. Vercel may not reproduce the isolated container's native
platform, function traces or Node patch. Inspect actual built native files,
effective vendor patch, dependency inventory, size limits and notices. Do not
reuse a synthetic-config local build as a production-origin deployment artifact.

## Environment and service contracts

No hosted variable presence has been inspected. All live presence rows are
BLOCKED; names below are source requirements, never credentials. No NEXT_PUBLIC
secret or environment-value export is required for this application.

| Name | Build / runtime role | Acceptance requirement |
| --- | --- | --- |
| DATABASE_URL | Prisma generation/build imports and web/worker native MySQL runtime | Build uses disposable loopback fixture; runtime uses private least-privilege MySQL URL, finite reviewed pool/connect timeouts and accepted egress |
| ROUTEVERITY_DATABASE_CA | Hosted runtime, both application and auth Prisma clients | Required for intended Aiven private CA; implemented adapter validates CA validity, writes0600temp file and sets sslaccept=strict. Unset bypasses that adapter; do not assume hosted strict TLS without evidence |
| NEXTAUTH_URL | Build metadata/headers and runtime host routing, auth origin | Approved canonical HTTPS app origin; no production aliases guessed. Separate preview origin/cookies; rebuild when build-visible origin changes |
| NEXTAUTH_SECRET | Authentication runtime | Unique private per-environment secret; disposable build fixture is never deployed as runtime secret |
| EMAIL_SERVER / EMAIL_FROM | Email sign-in runtime; health notification runtime | Verified sender and TLS SMTP, preferably explicit SMTPS for sign-in. Alert helper enforces remote TLS/timeouts; NextAuth uses its own EmailProvider configuration, so its transport must be checked separately |
| UPSTASH_REDIS_REST_URL / TOKEN | Web rate limits and health runtime | HTTPS REST service, scoped private token; no localhost fixture or unauthenticated fallback in hosting |
| ROUTEVERITY_OPERATOR_EMAIL | Optional operator identity | Unset disables operator access; configure only an approved verified account |
| ROUTEVERITY_ALERT_EMAIL | Health worker with --notify | Approved recipient; SMTP acceptance and actual inbox delivery both need later authorised evidence |
| ROUTEVERITY_PUBLIC_INDEXING | Build and runtime | Keep unset during staging/preparation; enabling requires separate launch approval and matching build/runtime settings |
| ROUTEVERITY_LICENSE_AUDIT | Build inventory instrumentation | Use1 for inspected release build; not permission to publish or collect customer telemetry |
| AXIOM_TOKEN / AXIOM_DATASET | Existing optional server logger selects external transport | Presence BLOCKED; sensitive-error finding below must be fixed even when unset |
| PLANETSCALE_DATABASE_URL | Retained legacy adapter / local harness | Not an active product runtime requirement; active app/auth use native MySQL, not a PlanetScale HTTP proxy |
| ROUTEVERITY_MYSQL_PASSWORD / ROOT_PASSWORD | Local Compose only | Never copy local/root database credentials to Vercel or workers |

Actual build evidence uses synthetic SQL/Redis/SMTP values and no live service.
Hosted readiness must separately verify runtime presence, TLS, scopes, expiry,
rotation ownership and dependencies using masked results. Build-time capture of
NEXTAUTH_URL/indexing flags means environment changes can require another build.
Do not print decoded URLs, recipient values, tokens or provider raw env responses.

MySQL requires the application/schema and compatible indexes, strict TLS, finite
connection budgets and a reviewed allowlist. There are two web Prisma clients
(app and NextAuth), plus separate worker clients. Budget aggregate warm-instance
pools and worker/maintenance connections below the actual service limit, with
headroom; measure burst behavior. Current live limits/grants/CA/egress unknown.
Do not broaden the allowlist to0.0.0.0/0 to avoid static-egress costs.

No committed Prisma migration directory was found in this candidate; historical
setup used schema push under earlier scoped approval. Table-count narratives
are dated and not current schema proof. Inspect metadata read-only, compare
against this exact schema, generate a reviewed additive SQL plan and test on an
isolated clone. Never replay initialisation, run db push/reset or assume migrations
are unnecessary. Runtime principal has no DDL/admin grant; migration identity is
separate and used only with explicit production-change approval.

Public mail DNS points to Migadu, SPF authorises Migadu and DMARC is quarantine.
That establishes no mailbox existence, SMTP app credential or delivered alert.
Resend remains a proposed alternative, not an observed configured sender. Reuse
the verified existing SMTP capability if suitable; any Resend sender/DKIM/DNS
change needs its own approval and must preserve existing inbound mail.

## Request and worker architecture

| Workload | Hosting recommendation and exact behavior |
| --- | --- |
| Transparent GET /click | Vercel Node dynamic handler; validate visible next hop, authenticate saved campaign/token/domain, rate-limit via Redis and await durable SQL audit before302. No destination fetch or worker shortcut |
| Conversion / merchant ingestion | Vercel Node request handlers with bearer auth, tenant policy, bounded input and durable MySQL transaction/idempotency; independent from browser arrival and background merchant reconciliation |
| Enrichment | One supervised external `pnpm routeverity:enrich-clicks --watch`; two-second idle wait, conditional updates, clears raw UA; SQL is durable queue |
| Retention | One external `pnpm routeverity:retain-data --apply --watch`;60second idle wait. Production deletion authority required before starting; no-flags dry run is not worker acceptance |
| Merchant reconciliation | One external `pnpm routeverity:reconcile-merchants --watch`;60second wait and bounded24hour policy; run before customer ingestion is enabled |
| Integrity | One serialized timer/service for `pnpm routeverity:redirect-audit`, proposed every60seconds; successful scan must remain less than10minutes old |
| Monitor / alert | One `pnpm routeverity:health --watch --notify`, one-minute observations and hourly per-process incident cooldown; add an independent external dead-man check so loss of this host is detected |

Recommend the existing Linode VM for one nonroot supervised process per worker,
only after recovery/security/boot acceptance and explicit activation approval.
Systemd watch services plus one non-overlapping integrity timer are simplest;
shared run-ID heartbeat is not a distributed lease and does not prevent two
instances doing work. Do not duplicate watchers across VMs/serverless cron/CI.
Verify graceful shutdown, restart after failure/reboot, matched source version,
resource limits, rotated secret files, logs and actual incident/recovery delivery.
No inbound public worker API is needed. An external monitor must observe host
loss independently; five processes on one VM do not provide HA.

Ordinary function lifetime/after-response work is not a reliable continuous
worker host. Vercel documents that waitUntil/after tasks remain bounded by
function timeout. [Function lifecycle reference](https://vercel.com/kb/guide/troubleshooting-inconsistent-logs-in-vercel-functions).

## Security findings and unresolved live controls

| Control | Actual candidate10 evidence | Remaining acceptance |
| --- | --- | --- |
| HTTPS / host routing | Presented public certificates validate; middleware requires configured origin and routes other hosts differently, allowing /click independently | Canonical app host, aliases, renewal and secure auth cookies on hosted system not accepted |
| Auth / authorisation | NextAuth database sessions7days, email link15minutes; membership/disabled workspace and write-role/operator checks exist | Hosted sign-in, user verification and tenant isolation with isolated fixtures; no live customer session used |
| Rate limits | Redis atomic increment+expiry; click6000/campaign/minute, conversions600/workspace/minute, email5/15minutes, mutations60/user/minute | Actual service limits, connection/retry behavior and WAF abuse coverage unknown; no Redis failure fallback accepted |
| Input bounds | Tracking query16,384characters, target8,000characters, strict fields/HTTPS; conversion/merchant JSON stream16KiB | Provider URI/body limits may reject earlier; execute supported maximum/adverse cases in authorised staging |
| Dependency timing | Click lookup1500ms, Redis750ms, durable audit1500ms; SQL transaction maxWait1000/timeout1500. Ingestion transaction10seconds; health3seconds | Promise-race deadlines do not cancel SDK operations; conversion initial lookup/Redis/body reading has no equivalent total application deadline. Review effective function duration and DB/Redis timeouts |
| Persistence / secrets | Durable transactional audit, hash-only credentials/advertising IDs; CA strict adapter, private env design | Hosted grants/pool/egress/rotation/retention/backups and provider encryption settings BLOCKED |
| Logging | Normal click/conversion/merchant telemetry uses bounded fields without raw targets/tokens. Synthetic error-hook probe below reproduces unsafe exception telemetry | Block real hosted tracking until fixed; no claim that current production logs were inspected |
| Incident / abuse | Local worker heartbeat/expiry/integrity checks and SMTP alerts; public contact@routeverity.com approved | Actual WAF rule, delivered mailbox, abuse ownership/response drill, uptime/dead-man and restore evidence absent |

**Reproduced local privacy defect:** active `instrumentation.ts` wires
createOnRequestError from @axiomhq/nextjs0.1.6 to the existing server logger.
An in-memory transport test using synthetic values confirms complete request
path/query, Authorization and Cookie are retained in the event sent to configured
transports. Actual ConsoleTransport also prints the full path for a non-Error
throw. Axiom transport is selected only when both AXIOM names are configured;
hosted presence is unknown. This does not prove current production disclosure.
Additionally `mutations.ts` prints unexpected raw error objects. Turning off
Axiom alone does not close these paths. `withAxiomBodyLog` can log body/query but
has no observed active product call site; it is not reported as an active route.

Next smallest local package: replace active exception telemetry with an allowlist
of fixed event/type and generated correlation ID, no request/query/headers/body/
raw message/stack/cause. Replace mutation raw errors; add Error/non-Error and
transport/console regressions, then freeze a new runtime candidate and rerun
acceptance. A prepared local patch package is retained in private E188 evidence;
no application code was changed by this inspection.

Vercel runtime/build/firewall/request logs and any log drains may have independent
metadata retention. Read-only review must inspect field names/settings and
aggregate error codes, not export raw customer requests. Later staging should
use synthetic sentinels to test every enabled sink and access/retention policy.
The [runtime log documentation](https://vercel.com/docs/logs/runtime) describes
request-path metadata but is not evidence of this account's query redaction.

## Cost comparison for approval

USD/month reference prices checked31October2026; taxes/usage and account terms
additional. Existing Vercel Pro is reused; no second paid account/seat proposed.

| Option | Conditional additional reference subtotal | Trade-off / decision |
| --- | --- | --- |
| Existing Pro + recovered existing worker VM + Aiven Developer | $5DB + actual worker/operations bill; add$100/project if Vercel static egress required | Preferred reuse pending capacity/worker acceptance; current invoices and runtime egress unknown |
| Existing Pro + new2GB worker VM + same DB | $12worker +$5DB = $17; $117 with static egress | Price reference only, no purchase authorised; memory/region/load need acceptance |
| Same Next app and workers on a4GB VM + managed DB | $24VM +$5DB = $29 before operations | Avoids Vercel static-egress charge with fixed VM egress, but adds web/TLS/reverse-proxy/patch/availability operations; material hosting change requiring approval, not a redesign or current action |

1GB VM reference$5 is not a verified capacity recommendation for five processes.
Redis free256MB/500Kcommands and Resend free3Kemails/month/100day are conditional
quota options, not observed account state or production guarantees. Existing
Migadu mail bill remains unknown. Vercel Pro base$20 is already incurred per owner;
usage beyond available credit, native image processing, off-site backups, log
retention, monitoring, transfer and recovery capacity are unquoted. Aiven$5
Developer is single-node/test-personal, not an accepted HA production SLA.
Choose availability objectives and accept a complete budget before provisioning.

Sources: [Akamai CPU](https://www.akamai.com/cloud/pricing/cpu),
[Vercel pricing](https://vercel.com/pricing),
[static egress](https://vercel.com/docs/networking/static-ips),
[Aiven MySQL](https://aiven.io/pricing/mysql),
[Aiven Developer](https://aiven.io/developer-tier-pg-mysql),
[Upstash](https://upstash.com/pricing/redis),
[Resend](https://resend.com/pricing).

## P3 decisions and separate release gates

Maintain the existing four unresolved entries; no notice-index entry was removed:

| Issue | Engineering material required | Acceptance decision |
| --- | --- | --- |
| GNU native bundle1.3.4 | Exact hosted native file inventory, component copyright/licence texts, pinned source/build/modifications and effective replacement/relinking material | Qualified actual hosting-conveyance/combined-library review; no generic Apache-script licence substitution |
| musl native bundle1.3.4 | Determine whether conveyed in final output; remove from packaging only with verified trace/runtime safety, otherwise supply same materials | GNU execution alone does not waive obligations for any conveyed musl binary |
| client-only0.0.1 | Obtain exact-version rights-holder/repository evidence for MIT notice/copyright; compare to package bytes | Qualified provenance acceptance; cannot borrow React notice on a guess |
| server-only0.0.1 | Same version-specific evidence requirement | Same; missing supplied npm text alone does not establish an actual violation |

The existing [licensing review](native-licensing-review.md), source identity and
AGPL matching-source gates remain authoritative. Owner final publication approval
is absent. None of these blocks independent read-only P4 work.

| Readiness area | Status | Gate |
| --- | --- | --- |
| Source release | BLOCKED | Four legal/provenance items, residual security/logging acceptance, approved matching publication |
| Production infrastructure | IN_PROGRESS | Authenticated account checks BLOCKED; no activation performed |
| Hosted click tracker | NOT_STARTED | Approved isolated hosting and source/privacy fixes, dependencies, workers and hosted tests |
| Google certification | IN_PROGRESS | Draft/evidence preparation only; live Ads/customer example/reliability absent, submission NOT_STARTED |
| Commercial SaaS | NOT_STARTED | Billing/entitlements deferred and must not block certification preparation |

Follow [deployment runbook](deployment-runbook.md) only after its separate
approval gates. P4-A is not complete while account/domain/renewal/configuration
acceptance remains blocked. Production hosting is not VERIFIED_COMPLETE.
