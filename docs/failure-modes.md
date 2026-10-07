# Transparent redirect failure modes

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
