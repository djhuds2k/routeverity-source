# Disabled upstream features

Dependency boundary update,2026-10-31 (E186): removed the active web manifest's
unused `@boxyhq/saml-jackson` and direct `minimatch`. SAML/SCIM/SSO and legacy
referral-fraud rules are outside the shipping product; retained reference code
does not enable those features or promise its former SDKs remain installed.
The former SDK was the only node-forge parent in the lockfile. Axios/proxy
follow-redirects inputs are pinned to1.16.2 within the existing major version.
Other glob/minimatch generations remain in build/email tooling and need separate
API-compatible migration; their presence is not silently cleared.

Dependency boundary update, 2026-10-30: the active web manifest no longer
declares `@mendable/firecrawl-js` or `@team-plain/typescript-sdk`. Active routes,
RouteVerity logic, request-error instrumentation, shared packages and product
tests have no imports of these SDKs, and the instrumented build does not observe
them in emitted modules or server traces. Old reference/support/scraping code
is not restored or supported by retaining its source; it would need separate
dependency and security work before being enabled. Other workspaces can still
retain their own legacy dependency graph, including Zod 3.

Milestones 2/3 add independently developed campaign configuration and a transparent
redirect engine with minimal durable audit and revocable credentials;
it does not restore upstream campaign/partner functionality. See the
[transparent redirect contract](transparent-redirect.md)
for policy, status, access and deferred-tracking boundaries.

Milestone 4 adds independent click reporting and a database-backed enrichment
scanner. It does not restore upstream analytics streams/jobs. The retained
`defineJob` framework imports excluded cron functionality and is not shipped;
the user chose a repeatable local scanner instead of QStash integration.
Milestone 5 adds independently developed conversion goals, header-authenticated
ingestion, immutable direct-click attribution and currency-separated reporting.
It does not restore upstream conversion routes or EE behavior. Geo/unique
visitors, raw advertising ID retention and billing remain deferred. See [conversions](conversions.md).

Milestone 6 independently adds Google setup/template validation, bounded source
parameters and hash-only Google identifiers. No upstream tracker, Google API
integration or licensed business logic is restored. Live Google verification,
conversion uploads and automatic parallel-tracking correlation remain unavailable.
See [Google Ads](google-ads.md).

## Explicit product boundary

The user approved moving the permitted upstream route tree outside Next.js's
active `app` directory rather than reconstructing unrelated Dub workflows.
`apps/web/upstream-reference/app` and its public assets, host middleware and
Next configuration are non-shipping reference material. None of the excluded
EE implementations were present or moved. Their original sparse-exclusion
paths remain unchanged.

The active tree is `apps/web/app`. Its server implementation is
`lib/routeverity`, with independently developed workspace/link/domain actions,
NextAuth's OSS email provider and Prisma adapter, the existing OSS ID generator
and Prisma singleton, and permitted shared UI components. The existing schema
is retained; additive domain type, suspension and ownership-token fields are
independently defined. No old migrations were imported.

Strict web typecheck covers every active route/component, middleware, product
library and product test, plus transitive imports and Next-generated route
types. It intentionally does not compile dormant upstream application code.
There is no `ignoreBuildErrors` or success-shaped substitute for an unavailable
backend. Product routes are not merely hidden in navigation: obsolete API,
partner, admin, billing and conversion routes are absent from the active tree.

## Direct OSS → EE dependency inventory

Paths below identify permitted **consumers**, not EE implementations. `old app`
means a path now under `apps/web/upstream-reference/app`. Other paths remain
under `apps/web` but are not reachable from the active graph.

| Permitted consumer(s)                                                                                         | Excluded dependency                                            | Classification                          | Resolution                                                           |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| `lib/cron/with-cron.ts`                                                                                       | EE cron `logAndRespond`                                        | DEFER — NOT REQUIRED FOR V1             | No upstream cron wrapper/job endpoint is shipped                     |
| old app `api/postbacks/callback/route.ts`                                                                     | EE cron helper                                                 | REMOVE FEATURE                          | Partner postbacks have no active route                               |
| old app `api/veriff/webhook/route.ts`, `handle-session-event.ts`, `handle-decision-event.ts`                  | EE cron helper (3 imports)                                     | REMOVE FEATURE                          | Identity verification/payout onboarding removed                      |
| old app `api/callback/stripe/route.ts`                                                                        | EE subscription webhook re-export                              | DEFER — NOT REQUIRED FOR V1             | No Stripe callback, checkout, portal or subscription mutation route  |
| old app `app.dub.co/(dashboard)/[slug]/links/domains/{page,layout}.tsx`, `default/page.tsx`, `email/page.tsx` | EE domain settings page/header/default/email UI (4 imports)    | REPLACE WITH ROUTEVERITY IMPLEMENTATION | Independent list/add/remove/TXT verification/suspend/type interface  |
| `ui/partners/partner-network/network-partner-sheet.tsx`                                                       | EE network invitation and email preview (2 imports)            | REMOVE FEATURE                          | Partner marketplace/invitations not shipped                          |
| `ui/partners/bounties/bounty-social-content.tsx`                                                              | EE referrals embed hook                                        | REMOVE FEATURE                          | Bounties/referrals not shipped                                       |
| `scripts/stripe/backfill-discount-code-sales.ts`                                                              | EE customer-metadata and promotion-code helpers (2 imports)    | REMOVE FEATURE                          | Old backfill script is not a product command/source export input     |
| `tests/stripe/update-customer-with-stripe-customer-id.test.ts`                                                | EE Stripe update helper                                        | DEFER — NOT REQUIRED FOR V1             | Retained unchanged; not part of the product suite                    |
| `tests/misc/submitted-lead-comment-access.test.ts`                                                            | EE partner/workspace submitted-lead comment routes (2 imports) | REMOVE FEATURE                          | Retained unchanged; tests an intentionally unshipped partner feature |
| `tests/misc/submitted-lead-comment-notification-routes.test.ts`                                               | EE partner/program comment cron routes (2 imports)             | REMOVE FEATURE                          | Retained unchanged; not a RouteVerity feature                        |

This accounts for **20 direct import/re-export statements in 16 permitted
files** found by scanning all remaining web application, library, UI, script
and test TypeScript. A comment in `lib/api/links/get-final-url.ts` mentioning an
EE implementation is not a runtime dependency.

## Missing feature implementations and operational exposure

| Upstream area                                                                | Classification                          | Baseline behavior                                                                                                              |
| ---------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/api/track/{click,lead,sale,client,open,visit}` EE routes                   | DEFER — NOT REQUIRED FOR V1             | No upstream tracking endpoint restored; independent `/click` is documented in [transparent redirects](transparent-redirect.md) |
| Click-stat aggregation and link-clicked webhook stream consumers             | DEFER — NOT REQUIRED FOR V1             | No publisher/consumer or cron schedule activated; no fabricated analytics                                                      |
| Partner-stat streams, payouts, commission/reward/bounty processing           | REMOVE FEATURE                          | No customer navigation, API exposure, scheduled jobs or integrations                                                           |
| Affiliate programmes, partner portal, marketplace and partner integrations   | REMOVE FEATURE                          | Non-shipping reference only                                                                                                    |
| SAML, SCIM, SSO, Dub enterprise/admin workflows                              | REMOVE FEATURE                          | No providers/routes/admin customer navigation                                                                                  |
| Subscription callback and Stripe app                                         | DEFER — NOT REQUIRED FOR V1             | Free workspaces only; no fake billing success                                                                                  |
| Upstream campaign implementations                                            | REPLACE WITH ROUTEVERITY IMPLEMENTATION | Independent configuration and credential-bound `/click`; no upstream business logic                                            |
| Conversions, public API/webhooks                                             | DEFER — NOT REQUIRED FOR V1             | Clearly labelled “Soon”; no pretend screens                                                                                    |
| Advanced link routing, A/B tests, proxying, geo/device targeting, QR tooling | DEFER — NOT REQUIRED FOR V1             | Standard redirect persistence/resolution only                                                                                  |
| Tinybird/QStash onboarding/telemetry                                         | DEFER — NOT REQUIRED FOR V1             | Not required for auth/workspaces/dashboard/links/domains                                                                       |
| Domain automation, purchases, renewals, TLS provisioning                     | DEFER — NOT REQUIRED FOR V1             | Manual hosting/TLS setup; DNS TXT ownership verification only                                                                  |
| Email/password onboarding and password reset                                 | REPLACE WITH SIMPLE OSS IMPLEMENTATION  | Verified, expiring single-use email sign-in/signup; no partner/jobs/SAML coupling                                              |

Upstream `vercel.json` was moved to the reference area so it cannot schedule
unshipped or EE-only cron paths. No old deployment configuration is adopted.
Existing upstream helpers/types are retained where legally permitted but not
automatically part of RouteVerity's product.

## Known limits, not hidden failures

- Link CRUD currently provides create/list/remove, not advanced editing.
- Development links use `/r/{workspace}/{key}` on a loopback app origin.
  They do not collect analytics and are unavailable on non-loopback app origins.
- Verified custom standard domains use `https://{domain}/{key}`. The host must
  be manually attached to the deployment and TLS provisioned externally.
- A transparent domain can be reserved/verified/suspended, but cannot be used
  to create links until the independently developed transparent tracker exists.
- Settings allow owner-only workspace naming. Invitations/user administration
  and account-password workflows are not shipped.
- Full upstream lint/type/integration suites are not RouteVerity acceptance
  commands. Tests were not deleted to obtain green results.
- The shared UI package's standalone full-source typecheck retains unrelated
  Tailwind/DOM iteration diagnostics; its distribution build and the product
  strict typecheck are separate, required passing checks.
