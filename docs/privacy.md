# Privacy and retention

Owner-confirmed public details, 2026-10-30: RouteVerity is operated by
**Multitouch Displays Ltd.**; use **contact@routeverity.com** for support, privacy
and abuse enquiries. This authorizes the displayed identity/channel, not final
legal-policy approval, delivery testing or a support response commitment.

Preproduction implementation record, not legal advice, a final legal policy or
a claim of GDPR compliance. The public `/privacy` notice makes the same release
limitations explicit.

## Approved retention

The user selected these policies:

| Data                                                                                  | Expiry clock                      | Policy                                                         |
| ------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------- |
| Detailed click and redirect audit                                                     | Creation timestamp                | Default/maximum 90 elapsed UTC days; owner may choose 30 or 60 |
| Conversion event, payload/order hashes and retry receipts                             | Canonical conversion receipt time | Same workspace setting                                         |
| Merchant submissions (including pending/unattributed), order/payload hashes and retry aliases | First submission receipt time | Same workspace setting; retries and reconciliation do not extend it |
| Operator suspension/resumption audit, including reason and scalar actor/workspace IDs | Audit creation time               | 365 elapsed UTC days                                           |
| Pending raw user-agent input                                                          | Click creation time               | 24 hours maximum target; successful enrichment erases sooner   |

Records strictly older than the detailed/audit cutoff are eligible for permanent
deletion. Raw input at or older than the 24-hour cutoff is eligible for erasure.
No longer retention can be selected; shortening requires owner confirmation.
Increasing retention cannot recover deleted records. Campaign deletion does not
restart a clock or keep historical evidence forever. Suspended workspaces are
still processed, and orphaned detailed evidence uses the 90-day maximum.

`pnpm routeverity:retain-data` is a bounded read-only preview.
`pnpm routeverity:retain-data --apply` drains actual expiry batches;
`--apply --watch` repeats with a 60-second idle wait. This is independent of the
enrichment scanner, not a public worker endpoint or upstream job integration.
The configured database determines where erasure happens. No production schema
change, cleanup or worker hosting is included in this local implementation.

Physical deletion depends on running the cleanup worker. A stopped worker cannot
meet deadlines. Enrichment does not parse raw input after its 24-hour limit even
if erasure was delayed. Private worker health checks and opt-in SMTP
failure/backlog alerts are implemented locally; supervised hosting, external
monitor-outage detection and restoration procedures remain required before
hosting.

## Collection and reporting

Account email, membership and authentication/session data are separate from
tracking retention. The tracking application does not store IP addresses,
persistent visitor identities or visitor cookies in click/conversion records.
Click metadata contains bounded hostnames, user-agent-derived dimensions and
optional self-reported advertising fields. Google advertising identifiers are
SHA-256 fingerprints only; hashing does not guarantee anonymity.

P2-B merchant ingestion is implemented and local HTTP/SQL acceptance passes.
It requires an explicit granted measurement-consent assertion before persisting
minimal order/event/currency/amount/time data and a supplied GCLID hash. It stores
no browser identity, customer-reference field or freeform metadata. The
assertion is not legal proof of consent. Denied/unknown consent does not persist
a submission. Pending evidence is eligible for reconciliation for 24 hours;
missing/ambiguous identifiers are not guessed. Advertising hashes are cleared
when processing reaches an attributed or terminal state; a stopped scanner can
delay that processing, and normal workspace retention remains the physical
erasure backstop. Dedupe hashes are retained with the submission. See the
[merchant contract](merchant-integration.md) and its acceptance limits.

Conversion order IDs, opaque references and bounded scalar metadata are
customer-submitted and can be personal data. Do not send sensitive personal data,
credentials or unnecessary identifiers. Raw target URLs/query values/fragments
are not stored as redirect target data; integrity fingerprints are retained
until event expiry.

Reports/CSV reflect remaining records, not a permanent historical aggregate.
Conversion retention uses receipt time while reporting uses occurrence time.
A conversion can remain after its click evidence expires. Overview conversion
rate and per-redirect revenue join only retained allowed click evidence; total
conversion revenue still includes all retained conversions. Removed click
evidence blocks new attribution, and deleted conversion/receipt evidence cannot
enforce perpetual retries or reference deduplication.

## Cookies and authentication

Dashboard sign-in uses essential authentication/request-verification cookies.
The transparent click endpoint adds no visitor-tracking cookie. Email sign-in
links are valid for 15 minutes and sessions for seven days; token/session validity
is not a claim that expired database rows are immediately erased. Account/token/
session cleanup and comprehensive personal-data export remain separate work.

## Proposed subprocessors and deployment review

| Provider / arrangement | Current evidence | Review still required |
| --- | --- | --- |
| Vercel | Proposed web host; supplied existing project metadata | Actual account/region, agreements, log retention and transfers |
| Aiven MySQL | Existing service was provisioned historically | Current service/region, agreements, backups/restore and erasure |
| Infrastructure beneath Aiven | Historical proposal named DigitalOcean | Verify actual current provider chain; do not assert it is selected |
| Redis rate limiter | Upstash-compatible REST contract | Actual service identity, isolation, agreements, region and retention |
| Email | Existing DNS points to Migadu; Resend is an unselected alternative | Actual sending account, sender/inbox delivery, agreements, logs and transfers |

Prepared providers are not proof of a deployed application or completed legal
review. Infrastructure may process network addresses and operational logs even
when the application avoids retaining them. No external analytics, browser
conversion SDK or Google conversion upload is activated.

Live erasure does not instantly remove provider backups or previously downloaded
exports. Any published plan backup history is not evidence of the actual selected
service's backup retention, restore or erasure procedure. Reapply retention before serving restored data.
Customer exports require their own lawful handling/deletion.

## Remaining release gates

Worker health is a bounded latest-state snapshot (at most four named rows),
not customer tracking or an additional incident archive. Alert messages use
fixed issue codes, check time and dependency status, excluding customer records,
raw input and error messages. The recipient is supplied privately; no production
alert address or schedule is enabled. SMTP/provider delivery logs still require
review. See [failure modes](failure-modes.md) for thresholds and monitoring limits.

- Complete registered business details, controller-role/legal-policy review and
  lawful bases using the owner-confirmed name/contact above.
- Review processor agreements, international transfers and infrastructure logs.
- Establish rights-request review and larger-export fulfilment beyond the
  bounded active-product downloads below.
- Establish rights-request/support procedures and response handling for the
  owner-confirmed contact channel; delivery was not tested in this session.
- Configure/monitor cleanup and enrichment, verify recovery and backup erasure.
- Publish matching corresponding source before any deployment.

See [local development](local-development.md), [failure modes](failure-modes.md)
and [conversion semantics](conversions.md).

## Account and workspace deletion

Authenticated users reach `/account` from their workspace list or Settings.
The page lists owned workspaces including suspended ones. An owner must type
the exact workspace address and explicitly confirm permanent erasure; a stale
workspace revision or changed ownership rejects the action. Deletion removes
workspace memberships, links/domains, campaigns and destination policies, click
evidence, conversion events/receipts/goals and conversion credentials in one
transaction. P2-B extends this to merchant submissions and their retry receipts;
that extension passes actual local workspace-deletion acceptance. Failure rolls back the transaction
and produces an explicit error.
Large deletions can exceed the ten-second transaction deadline; no partial
success or background completion is claimed.

The user approved retaining operator incident audit rows for their separate
365-day period after workspace/account deletion. These rows keep random scalar
workspace/actor IDs and the operator reason, not an automatic snapshot of the
deleted account email or workspace name. Reasons must not contain secrets or
unnecessary personal data. This is not full erasure of incident evidence.

Account deletion is blocked while any owned workspace exists, including a
suspended workspace; it never silently deletes shared workspaces or leaves an
ownerless one. Ownership transfer is not implemented. Type the exact current
verified account email and explicitly confirm deletion. The transaction removes
memberships, account and live sessions/login tokens. Shared links are retained
with the author's user ID cleared; other users and their workspaces survive.
The user row lock orders account deletion with workspace creation and link
authorship so an already-started mutation cannot recreate a deleted author ID.
Signing up later is a new account, not recovery of the deleted one.

Transparent audit insertion now locks the enabled workspace before its durable
insert, ordering that insert with deletion. Conversion ingestion already uses
the workspace lock. In-flight responses authorized before deletion may finish,
but cannot insert new orphaned click/conversion records after deletion commits.
The redirect target is unchanged and the existing audit deadline remains in
force. A concurrent lock timeout rejects the request rather than redirecting
without its evidence.

These workflows affect the live application database only. External DNS,
hosting registrations, rate-limit keys, provider logs/backups and downloaded
exports are not deleted by these actions. Rate-limit keys expire under existing
TTL policy. Account deletion does not delete other customers' independently
submitted conversion references. The remaining legal/backup/rights-handling
review still applies.

## Bounded account and workspace export

The user approved owner-only full workspace JSON and synchronous limits of
10,000 rows per collection and 20 MiB total. `/account/export` downloads the
current user's profile, memberships, non-secret session/provider metadata and
authored-link references. It never downloads full shared-workspace content
through the personal-account route.

`/app/{workspace}/settings/export` downloads the current owner's retained
workspace configuration, memberships by user ID, domains, standard links,
campaigns/destination policies, click audits, goals, conversions and conversion
key metadata. Suspended workspaces remain exportable by their current owner
from `/account`, before deletion. Non-owners and foreign accounts receive 403;
existing filtered click CSV access is unchanged.

Both JSON formats declare `schemaVersion: "routeverity-export-v1"`, `scope`,
`exportedAt` and a scope notice. Dates use ISO UTC and revenue uses exact decimal
strings without floating-point conversion. Each download uses a repeatable-read
transaction (ten-second timeout); independent downloads are not a frozen
multi-request archive. Collections have deterministic ordering and include all
retained records, not just the dashboard's 50-row page. Query parameters are
rejected instead of pretending to filter a full-scope export.

Credential fields/hashes, login/session tokens, raw user-agent strings, internal
retry/order/payload hashes, other members' email addresses and operator incident
audits are not selected for workspace export. Personal export does not include
password hashes or provider access/refresh/ID tokens. Owner exports include
customer-supplied order IDs, opaque references, metadata, notes and standard-link
URLs: these can contain personal data or pasted secrets and need private
handling. No automated redaction of arbitrary customer text is claimed.

Downloads are private/no-store attachments, rate limited to ten combined account/
workspace requests per user per minute. Collection overflow or UTF-8 JSON size
overflow returns 413 **without a partial file**. The exact limits are 10,000 rows
per collection and 20 _ 1024 _ 1024 bytes including JSON framing. Larger assisted
exports are not implemented; this is a release consideration before accepting
data beyond those limits. Database failures return 503 with sanitized telemetry,
not an empty success archive.

This is active-product data portability, not a database backup, automatic legal
subject-access fulfilment or a claim of comprehensive GDPR compliance. Provider
logs/backups, retained operator incident history and customer-submitted personal
references still need an appropriate rights-request review. Exported files are
not erased by later account/workspace deletion or retention cleanup.
