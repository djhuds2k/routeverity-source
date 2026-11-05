# Independent conversion tracking

Milestone 5 adds immutable, authenticated server-reported conversion events.
No excluded Dub EE implementation, browser SDK, payment verification or hosted
deployment is included.

## Integration

Create a campaign-specific goal and workspace conversion API key on Conversions.
Goals have an immutable lowercase event key and ISO currency. Owner/member roles
can manage goals and keys; read-only members can inspect reporting.
At most five active keys are allowed. Random `rvcv_` secrets are shown once,
stored only as SHA-256 hashes, and permanently revocable. Tracking credentials
cannot create conversions.

POST `/api/v1/conversions` requires `Content-Type: application/json`,
`Authorization: Bearer <conversion-key>` and `Idempotency-Key: <reference>`.
Example body:

```json
{
  "click_id": "rvc_12345678-1234-1234-1234-123456789abc",
  "event": "purchase",
  "order_id": "ORDER-123",
  "revenue": "99.99",
  "currency": "GBP"
}
```

Required fields are click_id, event, order_id and currency. Revenue defaults to
zero. Optional timestamp must be an ISO timestamp with timezone; optional
customer_reference must be opaque and bounded. Metadata supports up to ten
scalar fields, 200-character strings and 2,000 total UTF-8 bytes. POST bodies
are limited to 16,384 bytes; unknown and duplicate JSON fields are rejected.
Use decimal strings for money: amounts are nonnegative with at most twelve
whole digits and three fractional digits, constrained by currency precision.
Stored and aggregated money uses Decimal(18,3), not floating-point totals.

GET `/conversion` (also `/api/v1/conversions`) accepts the same scalar fields
and an `idempotency_key` query parameter, but still requires the Authorization
header. No query secrets or GET metadata are accepted. Query length is limited
to 8,192 characters; duplicates and unsupported fields are rejected.
Prefer POST because GET references can appear in access logs.

The transparent redirect exposes `X-RouteVerity-Click-Id` in its response.
It does **not** inject that ID into the next-hop URL, set a visitor cookie or
automatically deliver it to the merchant. Your owned server integration must
securely obtain the ID. No browser integration is claimed.

The separate [merchant integration](merchant-integration.md) implements POST
`/api/v1/merchant-conversions`, using consented first-party GCLID-hash context
without reading the tracker response header. Its local API/lifecycle boundary is
verified: unit/types/lint/build and all 37 real local E2E scenarios pass.
It is not a standalone public resolver. A unique retained request is not proof
of a unique Google ad interaction: repeated clicks can share a GCLID.

## Attribution and retries

- The click must belong to the credential's workspace and have an allowed 302
  record with matching provided, validated and actual target fingerprints.
- Attribution is direct-click only, within **30 days inclusive**, measured at
  declared occurrence time. Missing timestamp uses receipt time. Before-click,
  future and expired occurrences are rejected.
- Goal currency must match. New events require an enabled goal and workspace.
- Historical clicks remain eligible after campaign suspension, archive or
  deletion, as explicitly approved, while click evidence remains within
  retention. Logical goals are not removed by event expiry.
- Events are immutable: no update, refund or correction API is provided.
- Idempotency is scoped to workspace and hashed key. Order dedupe is scoped to
  workspace, goal and exact case-sensitive reference fingerprint.
- Canonically identical retries return 200 with the original conversion ID.
  New events return 201. Changed retries/references return 409.
  Identical order retries using another idempotency key persist an alias.
- A new direct-click conversion cannot reuse an order reserved by merchant
  ingestion (`MERCHANT_ORDER_RESERVED`, 409). Conversely, merchant ingestion
  rejects a new submission for an accepted direct order. Already accepted direct
  retries remain supported. Avoid submitting one order through both APIs.
- Disabled goals permit accepted retries; disabled workspaces and revoked keys
  block even retries. Revocation/configuration and ingestion serialize through
  the workspace row lock; event and receipt are committed atomically.

Success JSON contains `conversion_id`, `duplicate` and `attribution_policy`
(`direct-click-30d-v1`). Errors contain a structured `error` and `request_id`.
Invalid payload/currency/time returns 400; bad credentials 401; disabled
workspace/goal 403; unavailable click/goal 404; conflicts 409; expired attribution
or invalid click integrity 422; rate exhaustion 429; dependency failure 503.
Unsupported methods return 405. Responses are no-store.
Workspace ingestion limit is 600 requests/minute, including retries.

## Reporting and release limits

Conversions provides UTC occurrence-date, campaign and goal filters, separate
currency totals, daily count/revenue charts with exact zero-filled tables, goal
breakdowns, deterministic 50-row pages and owned event detail linked to clicks.
Click detail shows its latest 50 retained conversions. Overview reports retained events,
currency-separated revenue, revenue per prepared redirect and distinct
converted click IDs divided by retained prepared redirects, **not unique people**.
Conversion rate and per-redirect revenue include only conversions whose allowed
click evidence is still retained. Total conversion revenue can include events
whose click evidence has expired; it is not silently discarded.
Overview/report queries use repeatable-read snapshots per request; pagination
requests are live, not a frozen export.

Prepared redirects are not verified landing-page visits; late audit commits
can exist after a response deadline. Server-reported conversions are not
verified payments. There are no inferred visitors, costs, CPA, ROAS, currency
exchange, Google conversion uploads, outgoing webhooks or billing.
Milestone 6's [Google template setup](google-ads.md) does not change attribution:
parallel measurement does not automatically expose the click header to merchants.

Do not send email addresses, secrets or sensitive customer data in references
or metadata. Configure ingress limits/timeouts and redact Authorization,
payloads and postback queries in hosting logs. The database transaction has a
10-second timeout; a complete ingress/body/SDK deadline is not implemented.
The independent retention worker deletes conversions and retry receipts after
90 days from conversion receipt by default; owners can shorten to 30 or 60 days.
Occurrence time still controls reporting/attribution, not retention. Retry
receipts are drained in bounded batches before their conversion is removed;
ingestion and cleanup serialize through the workspace lock. Deleted evidence
cannot support indefinite idempotency/order dedupe, and expired click evidence
cannot support a new attribution. No update/correction API is added.
Owners can now delete workspace data, including conversions, goals, receipts and
credentials, through `/account`. Account deletion requires no owned workspaces
and does not silently delete shared data. Supervised cleanup operations, HTTPS,
larger-export/rights-request fulfilment and matching corresponding-source publication remain
release prerequisites.

Owner workspace JSON exports include retained canonical events, goal and
non-secret key metadata, order/customer references and bounded scalar metadata.
Revenue stays an exact decimal string. Credential, order/payload and receipt
hashes are not exported. The 10,000-row-per-collection and 20 MiB total limits
fail explicitly rather than producing partial data; see [privacy](privacy.md).

## Local checks

Use the existing isolated services and `pnpm --filter web prisma:push` (without
data-loss flags), then build/start using the documented product commands.
No new service, queue or dependency is needed. Acceptance fixtures use real
SMTP login and `/click` responses, never fetch third-party landing pages, and
remove their receipts/events/goals/keys before deleting their own workspace.

See [local development](local-development.md), [failure modes](failure-modes.md)
and [compliance preparation](open-source-compliance.md).
