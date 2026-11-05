# Click analytics

Milestone 4, independently developed and verified locally on 2026-10-07.
No hosted deployment, Google certification or comprehensive GDPR compliance is
claimed. Independent [conversions](conversions.md) are now available separately
using event occurrence dates; billing remains deferred.

## What counts as a click

The source of truth remains `RouteVerityRedirectAudit`: the minimal durable
event acknowledged before a transparent HTTP 302 is returned. No second,
failure-prone write or external queue was added to the redirect path. Reporting
counts records with `ALLOWED` validation and redirect status 302, scoped to the
authenticated workspace.

These are **prepared redirects**, not verified landing-page visits or unique
people. A late audit commit after the redirect deadline can exist without a
302 reaching the caller. Existing standard links remain unmeasured. Enrichment
does not change any destination, integrity fingerprint or redirect decision.

Older Milestone 3 records remain reportable as **legacy audit only**. Missing
metadata is not backfilled with invented device/referrer values.

## User-approved collection boundary

New events capture, in the same audit insert:

- A user-agent string bounded to 512 characters, used solely as pending input
  for asynchronous coarse device/browser/OS parsing.
- A valid HTTP(S) referrer **hostname** only. Credentials, paths, query strings,
  fragments, IP literals and malformed/private hostnames are not retained as
  referrer data. An absent/invalid referrer is labelled unavailable, not
  conclusively classified as direct traffic.

No IP address, visitor cookie, persistent visitor ID or raw advertising identifier
is collected. Milestone 6 optionally records hash-only Google identifiers and
bounded source values in the same event; see [Google Ads](google-ads.md).
Country and unique visitors remain unavailable.
Target URLs and bearer credentials are not recorded as plaintext target data;
target fingerprints and existing audit evidence are unchanged.

Headers are self-reported and can be absent, spoofed or inaccurate. Device
categories are parser-derived, not a bot/human classification, uniqueness
estimate or authentication signal. Nothing in this metadata selects a redirect.
User-agent strings and fingerprints can still be personal data.

## Independent asynchronous scanner

The user chose a database-backed CLI scanner rather than restoring the retained
upstream jobs framework, whose cron import reaches the excluded EE boundary.
This is not a QStash payload job: no upstream handler/registry, public worker
route, cloud queue or additional dependency is activated.

Drain pending records:

```powershell
pnpm routeverity:enrich-clicks
```

Watch in a separate attached terminal:

```powershell
pnpm routeverity:enrich-clicks --watch
```

The scanner reads at most 100 pending events at a time, oldest first. It uses
Next.js's already installed `userAgentFromString` helper; its bundled
`ua-parser-js` package declares **MIT**, not a newly installed parser version.
Keep its existing notices with the distributed dependency bundle.

Each successful conditional update writes coarse dimensions and `enrichedAt`,
and clears `rawUserAgent` atomically. It only updates records still pending.
Repeated or concurrent scanners do not duplicate events or counts. Missing UA
produces explicit `Unknown` dimensions. A crash leaves remaining work pending;
already processed records are not counted again. Failures exit nonzero with
sanitized structured logs; rerun after resolving the failure. Watch sleeps two
seconds only when a partial/empty batch is reached. No in-memory fire-and-forget
queue is used.

Stop watch with Ctrl+C. Configure a supervised scanner/retry schedule before
hosting. When it is stopped or broken, redirects still persist events and reports
show pending enrichment. Successful enrichment clears raw input immediately.
The independent [retention worker](privacy.md) now erases pending raw UA at
24 hours even if enrichment is stopped. Late enrichment uses explicit unknown
dimensions and a conditional raw-input check prevents stale enrichment from
overwriting a concurrent erasure. Hosted worker supervision and expiry monitoring
remain release prerequisites; stopped cleanup cannot guarantee erasure deadlines.

## Reporting and export

`/app/{workspace}/analytics` provides:

- Real prepared-redirect totals, enriched/pending/legacy counts and average
  decision preparation time. Timing excludes the audit wait/network; it is
  not labelled end-to-end redirect latency.
- UTC daily counts with an accessible data table and zero-filled missing days.
- Top-ten campaign, device, browser, OS and referrer-hostname breakdowns.
- Inclusive UTC date filters (default seven days, maximum 93 days), campaign,
  destination hostname and exact device/browser/OS filters.
- Deterministic timestamp/click-ID ordering and 50-row pages.
- Workspace-scoped click details and matched target fingerprints.
- Filtered CSV download, limited to 10,000 rows. A larger result returns 413
  rather than a silently partial file. Export includes all matching pages,
  never raw UA/target URLs/credentials. Cells are quoted and formula-prefixed
  strings neutralized for spreadsheet use. Per-user rate limit: ten exports
  per 60 seconds.

Reports use a repeatable-read transaction to keep each rendered summary,
chart and page internally consistent. Separate page requests/exports are live
queries, not a frozen multi-page snapshot; new events can change pagination.
Malformed/duplicate filters produce visible validation errors or HTTP 400.
Database errors are not converted into fabricated zero counts. Export backend
failures return 503 with sanitized error telemetry.

Owners, members, viewers and billing roles can inspect/export their workspace's
data. Every query, detail lookup and export remains tenant scoped. Deleted
campaigns are identified by their retained campaign ID rather than losing audit
attribution until the workspace retention deadline. Owners can choose 30, 60 or
90 days (default/maximum 90); expired click records disappear from reports,
details and exports after cleanup. No permanent aggregate archive is maintained.
Workspace owners can erase their workspace and its detailed evidence through
`/account`; operator incident history remains separately retained.
Owner workspace JSON export and personal-account JSON are available separately.
They exclude raw UA and credentials; provider/incident/rights-request handling
remains separate work.

## Verification and remaining work

Production acceptance covers real `/click` capture, pending reporting, CLI
enrichment, raw-UA removal, repeat drain idempotence, filtered CSV/detail, viewer
access, foreign click denial, mobile overflow, UTC boundaries, 50/51-row paging
and zero-filled days. The existing authentication, campaign and transparent
integrity tests remain in the product suite.

Only owned isolated SQL/Redis/SMTP services and local fixtures are used.
No third-party landing page is fetched and no live analytics data is fabricated.
See [local development](local-development.md) and
[measured redirect performance](redirect-performance.md).

Next milestone: independent conversion tracking. Advertising identifiers and
ValueTrack/templates wait for their Google Ads milestone. Geo, unique visitors,
cost/revenue metrics, bot detection and cloud analytics are not implied by the
availability of this minimal report.
