# Current RouteVerity architecture

Recovery scope update: 2026-10-13. The active product is the independently
implemented [Next.js application](../apps/web/app), with
[RouteVerity logic](../apps/web/lib/routeverity), additive Prisma schema and
[product tests](../apps/web/tests/routeverity). Permitted upstream routes were
moved outside the active route graph; restricted trees remain excluded.

- NextAuth email authentication and Prisma database sessions.
- MySQL-backed workspaces, campaigns, destination policies, durable redirect
  evidence, conversion goals/keys/events, retention and operational health.
- Transparent `/click` validates the visible next hop and uses that exact value
  as Location; metadata and database policy never substitute a destination.
- Redis REST supplies rate limits. Analytics/enrichment/retention/integrity use
  independent database-backed workers, not Tinybird or QStash.
- Tenant-scoped click/conversion reports, CSV/JSON export, deletion and private
  operator controls are implemented. Stripe billing and outgoing webhooks are
  not active.
- Existing RouteVerity assets, public layout and dashboard design are retained.

Milestones 1–6 have historical local acceptance; Milestone 7 remains partially
complete overall. E175 (2026-10-29) refreshes local build/unit/type/lint/boundary
acceptance, authenticated five-service health and all 40 browser/HTTP/SQL tests.
Hosted acceptance remains incomplete, and current dependency advisories require
security remediation before release. See the [source-release acceptance](source-release.md),
[redirect contract](transparent-redirect.md) and
[local setup](local-development.md) for implementation and validation boundaries.

## Historical Milestone 0 upstream inventory

Inspected 2026-10-06 at the commit recorded in [upstream-dub.md](upstream-dub.md).
The remaining sections describe the upstream inspection, not current feature
absence or current active-service requirements.

## Existing architecture

- Next.js 15.5.8, React 19.1.3, TypeScript, Tailwind and Turbo.
- A single web app multiplexes dashboard, API, tracking and partner/admin hosts
  through `apps/web/middleware.ts` and utility hostname constants.
- NextAuth 4.24.15 uses Prisma, JWT sessions, credentials, email links,
  Google/GitHub OAuth and additional SSO-related upstream hooks.
- Prisma 6.19.1 uses MySQL and `relationMode = "prisma"`.
  `Project` is the workspace model; membership and permissions already exist.
- Request-time SQL also uses PlanetScale's HTTP driver. A normal MySQL connection
  alone does not replace that HTTP interface.
- Upstash REST Redis provides caching, rate limits, click association,
  deduplication and streams. Global Redis credentials can optionally be separate.
- Tinybird stores click/conversion/webhook events and serves reporting pipes.
- QStash dispatches background work and signed webhook delivery.
- Vercel functions supply geo and background-task hooks. Local geo is fixture data.

## Reuse classification

`READY` means an isolated OSS building block is available; it does not mean an
end-to-end feature was proven. `NEEDS ADAPTATION` means useful OSS exists but
cannot satisfy RouteVerity unchanged. `EE - DO NOT USE` identifies excluded
surfaces even when related helpers are OSS.

| Capability | Classification | Evidence and limits |
| --- | --- | --- |
| Authentication | NEEDS ADAPTATION | `lib/auth/options.ts`, password helpers and account actions exist; retain normal auth, remove unwanted SSO/partner coupling after approval |
| Organisations/workspaces | NEEDS ADAPTATION | Workspace APIs, membership, roles, invitations and deletion are OSS; service/runtime verification remains blocked |
| Links | NEEDS ADAPTATION | OSS link APIs, caching, schema and management UI exist; UI has restricted icons and redirect features exceed v1 |
| Domains | NEEDS ADAPTATION | OSS domain APIs, validation and Vercel integration exist; main settings UI re-exports EE |
| Domain settings UI | EE - DO NOT USE | Dashboard EE route tree; independently supply only needed owned-domain UI |
| Click tracking | NEEDS ADAPTATION | OSS `lib/middleware/link.ts` and `lib/tinybird/record-click.ts`; not a deterministic durable transparent engine |
| Explicit click tracking API | EE - DO NOT USE | Tracked `/api/track/click` endpoint lies under EE |
| Analytics | NEEDS ADAPTATION | OSS reporting API, helpers, filters and Tinybird resources; campaign/cost metrics and complete aggregation pipeline need work |
| Geo | NEEDS ADAPTATION | Vercel geolocation headers/functions; fixtures on local dev, not a live local GeoIP service |
| Device/browser/OS parsing | READY | OSS click recorder uses Next's `userAgent`; reusable parsing primitive, not separately benchmarked |
| API keys | NEEDS ADAPTATION | OSS tokens APIs, hashed keys, scopes and workspace authorization; baseline role-scope tests passed |
| Webhooks | NEEDS ADAPTATION | OSS CRUD, HMAC-SHA256 signing, QStash callbacks and Tinybird delivery records; click-stream consumer is EE and v1 event names differ |
| Billing | NEEDS ADAPTATION | OSS Stripe client and workspace billing endpoints; existing subscription webhook is EE, so not complete SaaS billing |
| Subscription webhook / Stripe app | EE - DO NOT USE | Webhook implementation in EE; integration package separately proprietary-declared |
| Conversion helpers | NEEDS ADAPTATION | OSS `lib/api/conversions/track-lead.ts` and `track-sale.ts` include attribution and Redis deduplication; partner/workflow dependencies and durability need assessment |
| Public lead/sale/browser endpoints | EE - DO NOT USE | Existing tracked endpoint paths are in EE; do not infer permission from OSS helper locations |
| RouteVerity advertising campaigns | MISSING | Existing Prisma `Campaign` is partner-program email messaging, not the required advertiser/landing-domain model |
| RouteVerity transparent `/click` | MISSING | No RouteVerity implementation, policy/audit schema or conformance tests |
| Data export/deletion | NEEDS ADAPTATION | Analytics export and user/workspace deletion APIs exist; complete GDPR workflow and retention are unverified |

## Redirect behavior: reuse boundary

The existing middleware selects a database link and supports expiration fallback,
A/B tests, geo/device destinations, custom URI schemes, proxying and rewriting.
There is a Google-domain-specific HTTPS override using `redir_url`, but missing
or invalid override input can fall through to normal database routing; expiry
handling happens before the override.

The OSS click recorder skips bots, deduplicates clicks and uses asynchronous
ingestion; Redis failure can skip recording. These are existing Dub behaviors,
not the required durable redirect audit guarantee.

Consequently, this middleware is not a drop-in RouteVerity transparent redirect
service. Later Milestone 3 must be isolated from visitor-dependent destinations,
require the visible next hop, and prove `validated_next_hop === Location`.
No redirect changes, certification claims or Google template implementation
were made during this inspection.

## Infrastructure

Classifications refer to exercising a relevant existing feature, not merely
starting a Node listener. No remote service was provisioned or charged.

| Service/configuration | Classification | Actual dependency / local status |
| --- | --- | --- |
| MySQL 8 | REQUIRED FOR LOCAL DEV | Persistent users/workspaces/links; compose supplied, database not started |
| PlanetScale-compatible SQL HTTP endpoint | REQUIRED FOR LOCAL DEV; REPLACEABLE | Compose `ps-http-sim` port 3900 can bridge local MySQL port 3306 |
| Docker engine | REPLACEABLE | Convenient MySQL/proxy/MailHog runner; CLI exists but daemon is unavailable |
| Upstash-compatible Redis REST | REQUIRED FOR LOCAL DEV; REPLACEABLE | Needed for normal auth limits/caching/tracking; plain Redis TCP is not drop-in; no credentials configured |
| Tinybird API + deployed SQL resources | REQUIRED FOR LOCAL DEV for real analytics; REPLACEABLE | Not needed for isolated unit tests; no configured token or deployed project verified |
| QStash / Workflow | REQUIRED FOR LOCAL DEV for queued jobs/webhook delivery; REPLACEABLE | Callbacks also need reachable URLs and signing keys; no queue configured |
| Email provider | REQUIRED FOR LOCAL DEV for complete signup/email delivery; REPLACEABLE | Resend production path, local MailHog/SMTP configuration supplied; dev email login prints URL |
| Auth/encryption/cron secrets and host URLs | REQUIRED FOR LOCAL DEV for relevant flows | No local `.env` or deployment secrets created; source generation alone does not need a DB connection |
| Vercel Domains API and project/team configuration | OPTIONAL FOR LOCAL DEV; PRODUCTION ONLY for current domain automation; REPLACEABLE | Includes `VERCEL_PROJECT_ID` used in code but absent from example env |
| DNS/TLS/tracking hosts | PRODUCTION ONLY | No RouteVerity DNS or TLS configured; owned-domain deployment remains future work |
| Vercel geolocation/runtime cache | OPTIONAL FOR LOCAL DEV; REPLACEABLE | Fixtures and in-memory cache fallback locally; not production-equivalent |
| Stripe SaaS billing | OPTIONAL FOR LOCAL DEV; REPLACEABLE | Future commercial milestone; webhook implementation exclusion must first be addressed |
| Google/GitHub OAuth | OPTIONAL FOR LOCAL DEV | Credentials/email alternatives exist; OAuth apps not configured |
| Vercel Edge Config | OPTIONAL FOR LOCAL DEV; REPLACEABLE | Feature flags/blocklists; absence of config bypasses email blacklist in inspected helper |
| S3-compatible storage (upstream uses R2-style settings) | OPTIONAL FOR LOCAL DEV; REPLACEABLE | Needed for uploads/assets, not minimal unit tests; no storage configured |
| Axiom, Slack alerts, Plain support, Plausible | OPTIONAL FOR LOCAL DEV; REPLACEABLE | Monitoring/support/telemetry, not core persistence |
| ngrok or equivalent callback tunnel | OPTIONAL FOR LOCAL DEV; REPLACEABLE | Needed when hosted queue/provider callbacks must reach local server |
| Upstash Vector/emoji index, Turbopuffer | OPTIONAL FOR LOCAL DEV; REPLACEABLE | Search features; partner search is outside RouteVerity v1 |
| Anthropic/AI Gateway, Firecrawl, Unsplash | OPTIONAL FOR LOCAL DEV; REPLACEABLE | AI/scraping/preview features outside the core tracker |
| Dynadot, Domain Connect | OPTIONAL FOR LOCAL DEV; REPLACEABLE | Domain purchasing/automatic DNS; owned tracking domains do not need these flows |
| PayPal, Tremendous, Stripe Connect, Veriff | OPTIONAL FOR LOCAL DEV | Payouts/identity verification/partner functionality; outside v1 |
| Bitly, Shopify, AppsFlyer, Singular, HubSpot, Intercom, Segment, Zapier, Slack integrations | OPTIONAL FOR LOCAL DEV | Importers/integrations, not required core services |
| Google Ads OAuth/API | OPTIONAL FOR LOCAL DEV | Upload integration credentials exist upstream; templates need no Ads API provisioning |
| Twitter, TikTok, YouTube, Ahrefs, ScrapeCreators | OPTIONAL FOR LOCAL DEV | Partner/social verification outside v1 |
| PlanetScale backup service token | PRODUCTION ONLY | Upstream operational backup integration; not local DB setup |
| Playwright browsers and isolated test DB | OPTIONAL FOR LOCAL DEV; REQUIRED for local E2E | Not installed/provisioned during inspection; do not run seeding against a shared DB |

Full production deployability is not verified. See
[local setup and validation](local-development.md) for the observed baseline.
