# Transparent redirect failure modes

## Merchant ingestion and reconciliation

POST merchant submissions distinguish accepted receipt from attributed revenue:
201 can mean PENDING or terminal UNATTRIBUTED, not conversion success. Unknown/
denied consent is rejected before storage. Hash absence and ambiguity are
terminal; no first/latest/fuzzy fallback is used. Only absent durable evidence
with a valid hash can be retried, under original occurrence time, within the
approved 24-hour receipt-based reconciliation window.

The bounded scanner runs as `pnpm routeverity:reconcile-merchants [--watch]`.
Each pass handles at most 100 due active-workspace submissions, rechecks current
key/goal/workspace state and serializes with ingestion/deletion. Revocation or
unavailable goals terminate attribution; suspension pauses processing without
extending the deadline. Already attributed events remain immutable even if
later same-GCLID requests make that identifier ambiguous.

Database/integrity failure fails the pass rather than becoming no-match success.
The fourth latest-state worker row is MERCHANT_RECONCILIATION. Its missing/stale/
failed state is required by health when active merchant work is pending; pending
due work older than the ten-minute grace and expired merchant data also surface
explicit health issues. No pending workload means an unused merchant worker is
not a new startup failure for existing direct-click installations.

Merchant order reservations prevent a second conversion through the direct
endpoint, and accepted direct orders block new merchant submissions. Retry
receipts and parent submissions expire in bounded receipt-first batches under
workspace retention, including suspended/orphan data; deletion and export cover
the new data. Removed evidence cannot enforce perpetual retry/dedupe.

These paths build and pass unit checks and all 37 real local E2E scenarios,
including seven new merchant cases. The actual bounded CLI exited successfully
and its persisted success heartbeat was verified. Initial Windows launch denials
and a stalled orphan-server run were superseded by a clean full pass. No hosted
scanner supervision, production migration or live Google validation has occurred.

## Operator workspace controls

Operator access is disabled without explicit configuration and always depends
on the current, verified database account, not a session-provided email or a
workspace role. A stale workspace revision, lost operator verification, invalid
reason/operation, redundant state change or audit failure rejects the mutation.
Workspace state and audit evidence are committed together; failed transactions
roll back the provisional revision touch and state update. Ordinary members cannot
resume an operator-suspended workspace through normal workspace actions.

Suspension takes effect for subsequent policy lookups and workspace access.
Already authorized in-flight requests may finish; this is not cancellation of
issued requests. Resumption does not un-revoke credentials or un-suspend other
objects. Audits are append-only through the application, not database-enforced
write-once storage. The independent cleanup worker expires audits after 365
days; hosted scheduling and expiry-failure alerts remain release gates.

## Private worker health and alerts

The enrichment, applying retention and integrity workers persist start,
progress, success and failure in one latest-state row per worker. Dry-run
retention never writes a heartbeat. Deploy the additive worker-health table
before instrumented workers or the operator health page. A failed heartbeat
write fails the pass rather than silently running unmonitored work. Run only
one instance of each worker: a newer run supersedes the older run, whose
conditional progress/completion writes fail instead of replacing newer state.
This is not a distributed work lease or an append-only audit history.

The private CLI and currently verified operator page check actual MySQL and
Redis availability. Enrichment/retention progress becomes stale at five minutes;
integrity requires successful completion within ten minutes, not merely a
running heartbeat. Pending enrichment warns at ten minutes. Expired detailed
records, 24-hour raw input and 365-day operator evidence receive a ten-minute
expiry grace before critical alerts. Detailed expiry uses current workspace
30/60/90-day policy, conversion receipt time and orphan evidence's 90-day
maximum. Invalid stored policies and failed workers are explicit critical
issues. Missing workers and invalid/future timestamps are not healthy defaults.

Each dependency has a three-second observation deadline, and the snapshot uses
a bounded repeatable-read transaction. Deadlines do not cancel underlying SDK
work; process shutdown can take longer. Slow or failed queries report database
unavailability, never empty backlogs. Redis uses read-only PING, not key scans.

`pnpm routeverity:health` logs fixed issue codes and returns zero only when
healthy. `--watch` waits 60 seconds between checks. No emails are sent unless
`--notify` is provided with one privately configured `ROUTEVERITY_ALERT_EMAIL`;
the existing `EMAIL_SERVER` and `EMAIL_FROM` provide the SMTP channel. Remote
SMTP requires certificate-validated implicit TLS or STARTTLS. Messages contain
dependency status, check time and fixed codes, not customer records or error
messages. SMTP acceptance is not proof of inbox delivery.

An accepted incident starts an in-memory hourly repeat cooldown. Recovery is
sent only after an accepted incident; failed SMTP attempts are explicitly logged
and retried by the watcher without advancing state. Restarting the monitor or
an ambiguously failed delivery can duplicate messages. A stopped monitor cannot
alert on its own absence: an independent external dead-man check and supervised
hosting remain release requirements. No production scheduling, alert recipient,
schema installation or real alert delivery is enabled by the local tests.

## Retention and cleanup

Detailed records expire after 90 days by default; owners may shorten to 30 or
60 days with explicit confirmation. Clicks use creation time, conversions and
their retry receipts use conversion receipt time, and operator audits use a
separate 365-day limit. Pending raw user-agent input becomes eligible for erasure
at 24 hours regardless of enrichment status. Late enrichment never parses that
expired raw input and records unknown dimensions instead.

The CLI defaults to a read-only, bounded preview. Only `--apply` deletes records.
Each workspace cleanup transaction locks its current workspace row without
changing its revision, ordering deletion with ingestion and retention settings.
It reads the current policy even for suspended workspaces. Unsupported stored
policies fail explicitly rather than deleting against a guessed setting.
Historical evidence without a workspace uses the explicit 90-day maximum.

Every batch selects at most 100 clicks, conversions and retry receipts (library
maximum 500). Receipt batches are deleted before their conversion; a conversion
remains until all its receipts are drained. Related deletes share the workspace
transaction, and failure rolls back that batch. Completed earlier batches remain
committed. Reruns are safe; records exactly at the detailed/audit cutoff remain,
while raw input at the 24-hour cutoff is erased. Cleanup does not change targets,
credentials, goals, campaign state or retained integrity fingerprints.

A stopped cleanup worker cannot guarantee physical retention deadlines. Reports
and exports use remaining database records and therefore change after cleanup;
no permanent aggregate archive is maintained. Expired clicks cannot support new
attribution, and removed receipts/order records cannot enforce indefinite dedupe.
Retained conversions can outlive their click evidence because the two retention
clocks differ. Overview conversion rate and per-redirect revenue use only
conversions with retained allowed click evidence, avoiding inflated denominators
or conversion rates above 100 percent caused by expired clicks.

Live deletion does not instantly erase provider backups, infrastructure logs or
downloaded exports. Restoration must reapply expiry before serving restored data.
Larger-export/rights-request fulfilment, monitored scheduling and backup/log
retention remain separate release work.

## Account and workspace deletion

Typed exact confirmation and explicit checkboxes are required. Workspace
deletion locks and checks its current revision, then rechecks ownership before
erasing tenant data in one transaction. Suspended workspaces remain deletable
from `/account`; deletion does not resume them. State changes, stale forms,
changed roles and storage/deadlock/timeout failures produce errors, not partial
deletion-shaped success. The transaction deadline is ten seconds.

Account deletion locks the current verified user and refuses all owned
workspaces, even suspended ones. It revokes live sessions/login tokens, removes
memberships and clears link authorship without deleting shared links. Workspace
creation and standard-link authorship use the same user lock; writes for missing
accounts or revoked memberships fail. Operator scalar-ID incident history remains
under the approved 365-day retention, including operator reasons.

Durable transparent audit inserts acquire the enabled workspace lock before
insertion. This orders delayed inserts with workspace deletion, preventing
recreation of scalar-ID evidence after erasure commits. Existing 1,500 ms audit
deadline and fail-closed behavior are unchanged; lock contention may reject a
click. Earlier-authorized responses may still finish. Conversion ingestion
already orders inserts with the workspace lock. No target selection, visitor
classification or alternative redirect is introduced.

External DNS/hosting, backups, logs, expired Redis keys and exported files are
not instantly erased. Large workspace deletion can time out and roll back; no
automatic asynchronous purge is claimed. Infrastructure recovery/erasure and
larger-export/rights-request fulfilment remain release work.

## Account and workspace export

Full workspace JSON is owner-only, including suspended owned workspaces.
Account JSON contains only the current user's profile, memberships, non-secret
session/provider metadata and link-authorship references, not full shared
content. Current ownership is checked inside the repeatable-read export snapshot.
Auth redirects are preserved; non-owner or foreign workspace requests get 403.

Each collection is read with a 10,001-row sentinel. A collection over 10,000
records or serialized UTF-8 JSON over 20 MiB returns 413 without an attachment
or partial success file. Query parameters are rejected. Rate exhaustion returns
429, and database failures return 503 with sanitized telemetry. Larger assisted
export is not yet implemented, rather than an undocumented fallback.

Explicit field selections exclude credentials/hashes, raw UA, other members'
email addresses, internal retry hashes and operator incident history. Arbitrary
customer notes, metadata and standard-link URLs can contain sensitive text;
owner downloads must be handled privately. Downloads use no-store headers and
do not alter tracking state or retention clocks. Subsequent deletion cannot
erase already downloaded files. These downloads are not automatic legal
subject-access responses or restorable database backups.

## Domain ownership and mutations

TXT ownership checks run outside database transactions, using a DNS resolver
configured for one attempt with a 2,000 ms timeout. A missing or mismatching TXT
record clears ownership only if the domain snapshot is still current. A timeout
leaves the previous ownership status unchanged and returns an explicit retry
error; unexpected resolver failures are logged and surfaced as mutation errors.

Domain creation, verification, suspension, resumption and removal lock the
enabled workspace and recheck the current member's write permission. Existing
domain changes also compare the tenant, hostname, type, token and update revision.
Stale results return an explicit refresh/retry error rather than overwriting a
newer verification or suspension. Verification never resumes a suspended domain.
Removal retains serialized campaign/link reference guards; a rejected removal
rolls back its provisional suspension. TXT ownership is not a TLS/routing check
and does not provision external hosting.

Read-only production preflight on 2026-10-07 verified DNS, approved-project
association and strict TLS for both approved subdomains. The application host
returned Vercel `DEPLOYMENT_NOT_FOUND` (404) and the tracking host returned
`DEPLOYMENT_PAUSED` (503). These platform responses are not clean-application
health or redirect acceptance. Do not resume an old deployment merely to clear
this check; deployment still requires the matching source offer and release gates.

## Independent conversion ingestion

New conversions fail explicitly on invalid payload/time/currency, foreign or
integrity-invalid click evidence, disabled goals/workspaces, revoked credentials,
conflicting retries and expired attribution. Database/Redis failures return
503, never fabricated acceptance. Event/receipt writes are atomic; exact retries
return the original ID. New events do not modify the transparent redirect path.
The transaction timeout is 10 seconds; production ingress/body/SDK deadlines
still require operational work. See [conversion status contract](conversions.md).

## Redirect policy

Milestone 6's Google fields are bounded optional metadata, never alternate
destination controls. Duplicate/unsupported/malformed fields or unresolved
source macros return 400 without redirect/evidence. Empty optional values are
unavailable, not fabricated IDs. Identifier hashing shares the existing durable
write; there is no Google API/queue call or extra audit write before redirect.
Template generation errors are visible; generation does not verify public
DNS/TLS or Google routing. See [Google schema](google-ads.md).

Milestone 3 policy: reject without a Location header rather than guess a target,
redirect without core evidence, or fabricate success.

| Condition                                                                                                                                                | Behavior                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing/malformed/duplicate/unsupported query field or unsafe destination                                                                                | 400, no click ID or redirect                                                                                                                   |
| Unsupported HTTP method, including HEAD                                                                                                                  | 405 with `Allow: GET`; no click minted                                                                                                         |
| Missing/incorrect/revoked credential, unknown/inactive campaign, disabled workspace, wrong/unverified/suspended/archived/type-mismatched tracking domain | 404, no redirect                                                                                                                               |
| Destination not approved                                                                                                                                 | 403, no alternate/fallback                                                                                                                     |
| Campaign rate exhausted                                                                                                                                  | 429, `Retry-After: 60`, no redirect                                                                                                            |
| Database lookup unavailable or timed out                                                                                                                 | 503; cannot establish policy, so do not redirect                                                                                               |
| Redis limiter unavailable or timed out                                                                                                                   | 503; do not silently bypass abuse control                                                                                                      |
| Core audit insert unavailable or timed out                                                                                                               | 503; no success without an acknowledged durable event                                                                                          |
| Validated target differs from actual Location                                                                                                            | 503, critical integrity event; do not send Location                                                                                            |
| Tinybird/analytics, QStash/queue or geo service unavailable                                                                                              | Not dependencies of this path; valid redirects and core MySQL evidence continue                                                                |
| Destination DNS or landing server unavailable                                                                                                            | Not contacted by RouteVerity. Browser follows only the validated target; no fallback target                                                    |
| Tracking-domain DNS/TLS/routing unavailable                                                                                                              | Request may never reach the application; hosting responsibility, not fake verification                                                         |
| Persisted integrity monitor unavailable/mismatch                                                                                                         | Nonzero exit and structured error/critical event, never success-shaped output                                                                  |
| Enrichment scanner stopped or failed                                                                                                                     | Redirects and durable capture continue; pending state stays visible, raw UA remains until successful processing; scanner failures exit nonzero |
| Reporting/export database unavailable                                                                                                                    | Page error or explicit export 503, not fabricated empty success                                                                                |
| Invalid filters / export above row bound                                                                                                                 | Visible filter error / HTTP 400, or 413 with no partial export                                                                                 |

Database lookup and audit await each have a 1,500 ms response deadline; Redis
has 750 ms. These are fail-closed response deadlines, not a production latency
SLA. They do not cancel already issued SDK/database operations. A late audit
commit can describe a prepared 302 even if the caller received 503; audit
evidence must not be labelled completed visits. Core writes are never moved to
fire-and-forget tasks.

Rejections produce sanitized structured operational logs with request ID,
status, code, stage and elapsed time. They do not store arbitrary unauthenticated
input in the audit table. Logs omit full URLs, credentials, raw IPs and visitor
metadata; dependency exceptions are not echoed because they can contain
sensitive values. Hosted proxy/platform access logs must separately redact the
tracking query and Location header.

Policies are checked without a cache. Suspension/revocation applies to fresh
requests; a concurrent in-flight request uses the snapshot it already validated.
No error, rate-limit decision, bot classification or infrastructure failure
selects another destination. Existing standard-link routes retain their separate,
unmeasured baseline behavior.

Before production, connect failure/critical events and the integrity monitor
to operational alerts, tune service capacity/deadlines and implement documented
retention, backup, ingress protection and incident response. No deployment or
availability claim is made by local tests.
