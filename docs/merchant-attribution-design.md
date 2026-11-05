# Merchant attribution design

Updated: 2026-10-17. Status: P2-A internal candidate-resolution package locally
verified (26 unit cases; real merchant HTTP/SQL/conversion fixture in the
30-scenario E2E suite). Not a completed merchant product or validated live Google
integration.

P2-B update: authenticated merchant ingestion, minimal unmatched persistence,
24-hour bounded reconciliation, separate reporting and lifecycle wiring are now
implemented. P2-B status: **VERIFIED_COMPLETE within the local API/lifecycle
boundary**. All 594 web tests/three icons, types/lint/licensing/build and all
37 real local E2E scenarios pass. The actual scanner CLI and persisted success
heartbeat are verified. Earlier Windows execution problems are historical, not
a current test blocker. Hosted/real Google acceptance remains separate.

## Findings and official references

Reviewed official documentation on 2026-10-17:

- [Parallel tracking](https://support.google.com/google-ads/answer/7544674?hl=en):
  the merchant navigation and measurement request are separate; a tracking
  response header is not delivered to the merchant.
- [Auto-tagging](https://support.google.com/google-ads/answer/3095550?hl=en):
  a landing URL can receive GCLID, but an impression-created GCLID can be reused
  for repeated clicks. It is not universally a unique interaction ID.
- [ValueTrack](https://support.google.com/google-ads/answer/6305348?hl=en) and
  [final URL suffix](https://support.google.com/google-ads/answer/9054021?hl=en):
  advertiser-configured URL options are distinct from tracker-generated IDs.
  A campaign ID or static suffix is not a per-click correlation key.
- [Tracking URL options](https://support.google.com/google-ads/answer/6076199?hl=en):
  tracking/redirect URLs require HTTPS and server-side redirects.
- [Certification list/window](https://support.google.com/google-ads/answer/13707634?hl=en)
  and [application](https://support.google.com/google-ads/contact/3pcertification_transparent_click_trackers):
  current published annual window is September 1-November 30; a working domain
  and example are needed. Nothing submitted.

GBRAID/WBRAID availability and uniqueness must not be inferred from acceptance
by Google's upload APIs. No universally shared, per-interaction identifier has
been established. Do not invent braid ValueTrack macros.

## Method evaluation

| Method | Tracker observes | Merchant observes | Decision |
| --- | --- | --- | --- |
| Existing click-ID header | Its generated click ID | Nothing automatically under parallel tracking | Keep existing owned-server direct integration; not automatic Google correlation |
| First-party browser capture | Only metadata received by tracker | Landing query after consent, subject to browser restrictions | No browser SDK/endpoint/cookie added in P2-A; consent, cross-domain and exposure need later design |
| Merchant server capture | GCLID hash when actually supplied in tracker query | Its own landing query, when it actually contains GCLID | Selected limited internal candidate resolver; hash locally, never assume both sides have a value |
| Explicit advertiser suffix | Declared values actually reaching tracking request | Declared values reaching merchant | Useful configuration, not a guaranteed unique/common ID; no automatic URL mutation |
| Campaign/time/device/IP guess | Coarse metadata | Different coarse metadata | Rejected: no fuzzy matching, latest/first-click assumption, fingerprint or bot detection |
| Braids alone | Hash when supplied | Possibly a braid | Unsupported for exact click candidate resolution |

## Implemented internal data flow

1. Merchant server receives its own landing query and checks measurement consent.
2. Only with explicit granted consent, validate one nonempty GCLID and hash its
   exact case-sensitive bytes using the existing SHA-256 primitive.
3. Authorized server code asks the internal resolver for eligible retained
   records in its own workspace and RouteVerity campaign at conversion occurrence
   time. Read at most two records; two are already ambiguous.
4. Require an enabled workspace, matching stored GCLID hash, allowed redirect,
   valid integrity fingerprints and the existing inclusive 30-day window.
5. Return a unique **recorded-request candidate**, no match, ambiguity or explicit
   invalid/consent outcome. Never call it a confirmed human landing.
6. A fixture may submit the resulting explicit click ID through the unchanged
   conversion API; that API remains responsible for current key/workspace/goal
   checks, exact money, dedupe, idempotency and atomic writes.

No schema change, public resolver endpoint, raw-ID persistence, cookie, visitor
identity, outgoing webhook or Google upload is introduced by P2-A.

## Critical limitations and races

- A unique retained candidate is not proof of a unique Google click. A later
  duplicated tracker request can make the evidence ambiguous. A read-only
  resolver cannot reserve identity or make this race disappear.
- Merchant capture is an assertion, not independent proof of consent, landing,
  purchase or a human visitor. Hashes can still be personal data.
- Missing tracker request or late durable commit returns no match, not fabricated
  success. Retry decisions must preserve occurrence time and order/idempotency.
  P2-A does not store pending conversions or promise an eventual match.
- Retention can remove evidence or reduce a previously ambiguous set. Do not
  advertise unbounded historical uniqueness.
- Merchant sessions/cross-domain transfers and order binding are the merchant's
  responsibility under approved consent/privacy rules. Different browsers have
  no implicit identity linkage.
- A conversion occurring before the tracker timestamp cannot satisfy the existing
  direct-click time rule; no hidden clock-skew allowance is added.
- The JSON GCLID filter has no dedicated hash index. Workspace/campaign/time
  indexes and transaction deadlines constrain the prototype, but `take: 2`
  limits returned rows, not the number of rows scanned. Production capacity and
  query plans need measurement before exposing this as a public service.
- Supported GCLID syntax follows existing bounded Google validation. No Unicode
  normalization, lowercasing, trimming or plus-to-identifier substitutions.

## Reporting and completion boundary

Existing reports count recorded prepared redirects and accepted directly
attributed conversions. P2-B adds explicitly separated pending/unattributed
merchant submissions and reported amounts, never merchant landing observations
or a fabricated "confirmed visits" metric. Its local HTTP/SQL acceptance passes.

The next local package has owner approval for limited recorded-request matching
and minimal separately retained unmatched events with bounded reconciliation.
P2-B now implements strict POST transport, workspace conversion-key auth, atomic
order/idempotency handling, minimal unmatched data and bounded reconciliation.
It reuses the candidate resolver inside the workspace-locked transaction, not
as an untrusted browser lookup followed by a separate attribution write.
Retained rows store order/event/currency/amount/time, status/reason, source
credential ID and fingerprints; no raw Google ID, customer reference, metadata
or browser identity is added.

Matched/terminal events clear their advertising hash; immutable payload hashes
remain for retry comparison. Pending absence is rechecked at five-minute
intervals for at most 24 hours from first receipt, under original occurrence
time and key/goal/workspace rules. Ambiguity and missing IDs are terminal. A
later duplicated request does not retroactively rewrite a previously accepted
immutable recorded-request conversion; this is an explicit limitation of the
approved evidence model, not proof of universal uniqueness.

Orders are reserved across direct and merchant integrations to prevent double
counting. P2-B covers retention, deletion, private export, owner/member reporting
and worker health in code. See [integration contract](merchant-integration.md).
The new real HTTP/SQL scenarios pass; this is local synthetic integration,
not execution by Google or a customer's production merchant application.
P2 stays IN_PROGRESS for merchant reference integration/onboarding and actual
supported-context validation. Real Google remains unverified.
