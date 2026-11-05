# Merchant integration

Updated: 2026-10-18. P2-B merchant ingestion is **locally verified**: 594 web
tests/three icons, types/lint/licensing/build and all 37 real local E2E scenarios
pass. The actual reconciliation CLI also exits successfully and persists its
success heartbeat. No hosted deployment, browser SDK, standalone public
ID-resolution endpoint or live Google validation is claimed.

## Standalone server reference (follow-on source)

The owner selected preparation of a reference integration because no merchant
site is available yet. [The dependency-free Node 22 client](../examples/merchant-reference/client.mjs)
is server-only reference code, not a browser SDK, installed shop plugin or a
production-ready merchant service. This is new follow-on source; it is **not**
part of the accepted candidate3 archive and does not modify that immutable
archive or extend its historical validation results.

The reference deliberately keeps merchant authentication, consent management,
campaign mapping, session/order association and durable outbox storage in the
merchant's application. Those require a real merchant's approved design before
collection. It does not create cookies, persist identifiers, receive orders,
run a scheduler or make requests on import.

1. After the merchant's applicable consent decision, call
   `captureMerchantGclid(landingSearch, consent)` on the merchant server. It
   hashes only a single valid exact GCLID; never log the landing query/raw ID.
   Denied/unknown consent returns `CONSENT_NOT_GRANTED` before parsing.
   Missing/braid-only input returns `MISSING_IDENTIFIER`; repeated IDs return
   `AMBIGUOUS_IDENTIFIER`. Malformed identifiers throw a bounded error code.
2. Associate the hash with the appropriate owned session/order using approved
   storage and retention. Do not infer association from campaign ID or another
   visitor. Recheck current consent at checkout; a previous grant is not
   sufficient after withdrawal.
3. Once a genuine order is confirmed server-side, prepare exactly one envelope
   with `prepareMerchantConversion(order, context, currentConsent)`.
   `order` contains only `campaign_id`, `event`, `order_id`, string `revenue`,
   uppercase `currency` and the original ISO `timestamp`. Campaign/event/currency
   must match an enabled goal in the authorized workspace. Decimal precision
   and the supported currency list remain authoritative on the API server.
4. Persist the returned READY envelope once in the merchant's approved outbox,
   atomically with order finalization or with equivalent duplicate protection.
   It contains the serialized payload and a generated idempotency key, **not**
   the conversion credential. Preserve it byte-for-byte across attempts; do not
   call preparation again on every job/webhook retry. No outbox implementation
   or at-rest protection is supplied by this example.
5. Immediately before dispatch, recheck consent and call
   `submitMerchantConversion` from a trusted worker:

   ```js
   import { submitMerchantConversion } from "../examples/merchant-reference/client.mjs";

   // These values come from the merchant's trusted configuration/outbox/CMP.
   const result = await submitMerchantConversion({
     origin: configuredApplicationOrigin,
     conversionKey: serverOnlyConversionKey,
     envelope: savedOriginalEnvelope,
     currentConsent,
   });
   ```

   This is integration pseudocode, not an executable deployment command.
   The origin must be the existing approved application HTTPS origin, with
   no path/query/fragment/userinfo. No new public API hostname is assumed.
   An explicit `allowLoopbackHttp: true` permits HTTP only for localhost,
   127.0.0.1 or ::1 fixtures. Never configure the destination from customer input.
   The key is a workspace conversion key, not a tracking token or SMTP key.

6. Store only necessary outcome fields in the merchant's approved records.
   `PENDING` is awaiting bounded server reconciliation, not attributed revenue;
   `UNATTRIBUTED` is terminal. `ATTRIBUTED` means a matched recorded request,
   not proof of a unique Google click, human landing or independently verified
   purchase. Identical explicit retries may retrieve the current status, but
   this reference does not poll.

One dispatch makes at most one POST, has a ten-second default timeout (maximum
30 seconds), refuses redirects and bounds successful response bodies to 4 KiB.
It never automatically retries. Capture/storage/dispatch all need the merchant's
approved consent and retention policy; withdrawal must cancel queued work and
handle previously retained data under that policy.

Errors expose bounded `code`, `httpStatus`, `retryable` and numeric
`retryAfterSeconds` fields, not raw provider
bodies or credentials. Handle and report those fields in the merchant's approved
logging/alerting system; do not silently mark a rejected/uncertain order sent.
Timeouts, lost/malformed success responses and 408/429/5xx can leave acceptance
uncertain. Only an approved bounded retry policy may retry the **same** saved
envelope after checking current consent; honor `retryAfterSeconds` where supplied.
HTTP-date Retry-After values are not parsed; an adapter must handle them before
scheduling against a server that uses them. The reference makes no scheduling
decisions. Do not change occurrence
times or create a new key to bypass 409. 401/403 require authorization/consent
review, and 409 requires order/idempotency investigation. No refund/correction
flow is implemented.

Run `node --test examples/merchant-reference/client.test.mjs` for real loopback
HTTP transport tests. Current API-policy parity tests are in
`apps/web/tests/routeverity/merchant-reference.test.ts`; the normal
`pnpm routeverity:test` command includes both sets. Portable capture checks
deliberately mirror the existing internal helper rather than depend on the
application database; parity tests detect drift. These tests are synthetic
reference evidence, not merchant-owned, hosted or actual Google validation.

### Real local API acceptance (E84)

The standalone reference is also exercised against the actual local application
API, MySQL and Redis, not just the loopback response fixture. Run
`pnpm --filter web test:e2e:routeverity merchant-conversions.spec.ts` with the
dedicated local baseline services and app listening on localhost:8888.
The existing spec refuses a non-loopback SQL endpoint and creates only nonce
test workspaces/keys/orders; do not run it against hosted resources or alongside
watching cleanup/reconciliation workers.

Three reference-client cases cover concurrent identical requests producing
exactly one GBP99.990 conversion/receipt, explicit409 for a changed retry,
terminal missing/ambiguous evidence with no attributed revenue, pending retries
preserving original times/24-hour deadline, and current-consent withdrawal
preventing another submission. Seven existing merchant scenarios additionally
cover reporting/export, delayed reconciliation, authorization, expiry, retention
and cross-endpoint order protection. Scoped SQL cleanup is asserted after the
suite; fake local SMTP messages/short-lived Redis keys are not claimed securely
erased. This is acceptance against an existing local production-mode build,
not a fresh release build or actual merchant-owned/Google/hosted integration.

## Direct-click API

An owned server that genuinely has a RouteVerity click ID can use the existing
header-authenticated [conversion API](conversions.md). Random conversion keys
belong on the merchant server, never in landing URLs, browser bundles or a final
URL suffix. Tracking tokens cannot ingest conversions.

The tracker response's `X-RouteVerity-Click-Id` is not automatically available
to a merchant receiving Google's parallel navigation. Do not ask customers to
put a conversion endpoint into a Google tracking template.

## P2-B server-to-server contract

POST `/api/v1/merchant-conversions` on the **existing application origin**.
Use `Content-Type: application/json`, a workspace conversion bearer key, and
`Idempotency-Key`. No credentials in URLs, browser bundles or final URL suffixes.
No new API hostname, CORS browser integration or GET ingestion is provided.

```json
{
  "campaign_id": "cmp_your_campaign_id",
  "event": "purchase",
  "order_id": "ORDER-123",
  "revenue": "99.99",
  "currency": "GBP",
  "timestamp": "2026-10-17T14:00:00Z",
  "measurement_consent": "granted",
  "gclid_hash": "0000000000000000000000000000000000000000000000000000000000000000"
}
```

The hash above is a placeholder, not a Google identifier. Hash the exact
case-sensitive merchant-observed GCLID as UTF-8 SHA-256 on the merchant server,
only after applicable measurement consent. Never submit the raw GCLID. Omit
`gclid_hash` when unavailable; do not send a placeholder in real integration.
GBRAID/WBRAID, raw IDs, arbitrary metadata and customer references are unsupported.
Duplicate JSON fields, query parameters and unknown fields are rejected.

Occurrence timestamp and explicit consent are required. Denied/unknown consent
returns 403 without storing a submission. Revenue defaults to zero and follows
the existing exact decimal/currency rules. The existing 16 KiB JSON body limit
and shared 600/minute/workspace conversion rate limit apply.

New submissions return 201; identical retries return 200 with the same
`submission_id`, current `status`, `reason`, optional `conversion_id`,
`attribution_policy` and original `reconcile_until`. **201 does not mean
attributed, a confirmed landing, a verified purchase or a unique Google click.**

| State / reason                                                                        | Meaning                                                                                                                   |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `ATTRIBUTED` / `MATCHED_RECORDED_REQUEST`                                             | One eligible integral retained request matched; immutable conversion linked with `merchant-gclid-recorded-request-30d-v1` |
| `PENDING` / `NO_RECORDED_MATCH`                                                       | Valid hash, no currently eligible evidence; bounded reconciliation eligible                                               |
| `UNATTRIBUTED` / `MISSING_IDENTIFIER`                                                 | No supported identifier; terminal, not inferred from campaign                                                             |
| `UNATTRIBUTED` / `AMBIGUOUS_IDENTIFIER`                                               | Multiple eligible retained requests; terminal, never pick latest/first                                                    |
| `UNATTRIBUTED` / `RECONCILIATION_EXPIRED`                                             | Reconciliation eligibility ended without attribution                                                                      |
| `UNATTRIBUTED` / `CREDENTIAL_REVOKED`, `GOAL_UNAVAILABLE`, `ORDER_REFERENCE_CONFLICT` | Reconciliation stopped because current authorization/goal/order constraints no longer permit attribution                  |

Idempotency is workspace-scoped within this endpoint; order reservation is
workspace/goal/case-sensitive-order scoped. Canonically changed idempotency/order
retries return 409. Alternate identical idempotency keys create retry aliases,
not events. Original occurrence/receipt times and reconciliation deadline are
never extended by retry. Terminal unmatched events cannot be corrected/promoted
through changed payload retries; no correction/refund API is provided.

An order already reserved by merchant ingestion cannot create a second conversion
through the direct-click endpoint (`MERCHANT_ORDER_RESERVED`, 409). A new merchant
submission for an already accepted direct-click order also returns 409. Existing
accepted direct conversion retries remain supported. Do not submit one order
through both integrations.

## Bounded reconciliation and reporting

The owner approved a **24-hour window from first receipt**. Only pending no-match
submissions are rechecked, every five minutes when the worker is running; missing
and ambiguous identifiers are terminal. The original inclusive 30-day
click-to-occurrence rule remains unchanged. A genuinely later click cannot be
made eligible by changing the occurrence timestamp.

Run `pnpm routeverity:reconcile-merchants` for one bounded pass (at most 100 due
events), or append `--watch` for a 60-second polling interval. This is a
supervised database scanner, not a public job route or QStash integration.
It serializes each event with workspace changes, deletion and conversion writes.
Suspended workspaces are not processed. On resumption, expired pending events
terminate rather than extending their window. Missing evidence stays pending;
database/integrity failures fail explicitly rather than become no-match success.

Conversions reporting adds a separate paginated pending/unattributed section,
with per-currency **reported amounts**, excluded from attributed conversions and
revenue. A merchant submission and its linked conversion are not counted twice
in attributed totals. No confirmed-landing metric is invented. Inspect the
conversion's attribution-policy field for provenance.

Submission rows and their retry receipts follow workspace 30/60/90-day retention
from first receipt, including suspended/orphan handling. Reconciled conversions
use that same original receipt time. Bounded receipt batches drain before parent
rows are erased. Workspace deletion removes both new collections atomically;
owner export includes retained submission status/amount/order/timing but excludes
credential IDs, advertising hashes and internal retry/payload hashes.

The GCLID hash is cleared when a submission becomes attributed or terminal.
That processing depends on the scanner running; no immediate physical-erasure
guarantee is made while it is stopped. Order/payload/retry hashes remain for the
record's normal retention period and are not claimed anonymous.

## Internal first-party server fixture

The selected work package models two independent requests:

1. A merchant landing receives a fixture GCLID in its own query, and performs
   explicit consent-gated exact hashing.
2. A separate background `/click` receives the same fixture GCLID in tracker
   metadata, persists only its hash, and redirects to the unchanged visible URL.
3. Trusted local fixture code resolves a unique retained candidate in the
   authorized workspace/campaign. It does not read the response click-ID header.
4. The fixture submits the resolved click ID and its order through the existing
   conversion API, retries the identical order/idempotency context and verifies
   campaign attribution and exact revenue.

This is synthetic local integration evidence, not Google's execution, a shared
browser cookie or a confirmed human visit. It must also demonstrate no match
before tracker evidence and ambiguity after repeated identifiers.

## Consent, capture and loss

Do not capture/hash/send identifiers before the advertiser's applicable consent
decision. Denied or unknown consent skips capture; the helper performs no
network request or persistence. The advertiser must separately validate legal
requirements; a boolean/assertion is not legal proof.

One valid GCLID is required for this limited method; missing, empty, duplicated,
malformed or unsupported identifier input is explicit and never guessed.
GBRAID/WBRAID alone and campaign-only data do not resolve exact clicks.
Do not infer identity across browser contexts or domains. If landing redirects
strip an identifier, the integration cannot recreate it.

Merchant-side durable order/session association and consent withdrawal handling
need an approved implementation. No automatic cookie/local-storage code is
shipped by this work package.

## Retries and delayed evidence

Preserve the original conversion occurrence time and existing exact
order/idempotency fields. A pending background click can be absent initially;
only retryable absence, not ambiguous evidence, is a candidate for bounded
merchant retries. Do not alter timestamps or select the latest matching row
to force acceptance. The current window is 30 days inclusive at occurrence time,
and underlying click evidence must remain retained.

P2-A itself did not accept/store unmatched revenue or schedule reconciliation.
P2-B now implements the approved contract above, verified by local HTTP/SQL acceptance.
See [merchant attribution design](merchant-attribution-design.md) for provenance,
races, limitations and the remaining P2 acceptance gate.

## Local verification

On 2026-10-17 all 30 local E2E scenarios passed, including the independent
loopback merchant HTTP fixture, delayed visibility, workspace/campaign isolation,
inclusive 30-day cutoff, exact revenue, duplicate retry and repeated-ID ambiguity.
The merchant origin is a synthetic loopback substitute, not a hosted merchant or
Google's actual navigation. The 26 helper unit cases include denied/unknown
consent, malformed/repeated/missing IDs, braid-only input, concurrent ambiguous
readers and database failure propagation.

`captureMerchantGclid` and `resolveMerchantCandidate` are internal TypeScript
helpers. The latter accepts only an already-authorized workspace from trusted
server code; it is not a public authentication boundary. No unmatched events or
raw identifiers are persisted by either helper. The unchanged conversion API
still performs its own workspace/key/goal/time checks.

P2-B validation on 2026-10-17: 594 web tests and three icons, types, lint, licensing
and production build pass. All **37 E2E scenarios pass with no skips**, including
the seven new merchant cases and expanded workspace deletion coverage.
They verify actual POST transport, concurrent order/idempotency retry, exact
revenue, delayed evidence, terminal ambiguity/missing IDs, 24-hour expiry,
authorization/consent gates, separate reporting/export, cross-endpoint order
protection, backlog health and bounded receipt-first cleanup.

The late-evidence fixture removes/reinserts the same earlier prepared-request
audit to model commit visibility. It does not demonstrate that a genuinely later
click is eligible or that Google's actual delivery supplies a common identifier.
The one-pass CLI ran against an empty due queue after fixture cleanup; its
persisted SUCCEEDED heartbeat was checked separately. Positive work was exercised
through the same reconciliation library against real SQL in E2E.

Initial Windows runner denials and a stalled run against an orphan server were
resolved before the clean full pass. No application security settings were
modified or alternate executor used. Production supervision, query capacity,
merchant-owned order/session storage and real hosted/Google validation remain
release/integration requirements.
