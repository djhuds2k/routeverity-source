# Transparent redirect engine

Milestone 3, independently implemented and verified locally on 2026-10-07.
This is not a deployed or Google-certified service.

## Request schema: transparent-v2

Only `GET /click` redirects. The query must contain exactly one of each:

| Parameter     | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| `url`         | The visible, authoritative next-hop URL, form-encoded exactly once |
| `rv_campaign` | RouteVerity campaign ID                                            |
| `rv_token`    | Revocable, random per-campaign bearer credential                   |

Milestone 6 adds optional bounded Google fields: campaignid, adgroupid, creative,
matchtype, device, network, gclid, gbraid and wbraid. All other top-level fields
are rejected. Duplicate keys, including
percent-encoded duplicate names, malformed UTF-8/percent escapes and double
encoding are rejected. Raw Google IDs are never persisted; their SHA-256
fingerprints and bounded source values share the existing audit insert.
Inbound RouteVerity click IDs remain unsupported.
Legitimate query fields inside `url` are preserved; they are not tracker controls.

Construct a test URL with `URLSearchParams({ url, rv_campaign, rv_token })`,
or the campaign page's test URL builder. Do not pre-encode `url` before passing
it to `URLSearchParams`. This builder is not a Google Ads tracking template;
use the separate campaign Google setup tool and [Google contract](google-ads.md).
Tracking URLs contain bearer credentials: do not paste them into public logs,
analytics tools, shared screenshots or third-party validators.

## Authoritative target and validation

The database supplies policy, **never an alternate destination**. Validation:

- Requires HTTPS, valid syntax and a public DNS-style hostname.
- Rejects credentials (even an empty `@` authority), backslashes, whitespace,
  control characters, encoded control characters, malformed escapes, IP
  literals/numeric-IP representations, local/reserved hostnames and non-default
  ports. The default HTTPS port `443` is permitted.
- Accepts an outer query up to 16,384 characters and next hop up to 8,000.
- Preserves ASCII next hops verbatim, including query order, duplicate
  destination query fields, existing escapes, plus signs and fragments.
- Converts international URLs deterministically through the URL parser's
  IDNA/URI encoding. The encoded result is the validated next hop. Invalid
  Unicode is rejected. Provided and validated fingerprints may consequently
  differ; validated and actual fingerprints must always match.
- Applies exact hostname approval unless that policy entry explicitly opts
  into subdomains. Dot-boundary matching prevents suffix spoofing.
- Performs no destination fetch, DNS resolution, geolocation, enrichment,
  cookie handling, rotation or visitor-based destination selection.

Every successful response is HTTP **302** and satisfies an exact runtime check:

```text
validated_next_hop === response.headers.get("Location")
```

No UTM configuration, click ID or visitor metadata is appended to the target.
The server-generated `rvc_` UUID click ID is returned in
`X-RouteVerity-Click-Id`; a separate UUID is in `X-RouteVerity-Request-Id`.
Responses use `Cache-Control: private, no-store, max-age=0` and
`Referrer-Policy: no-referrer`. No cookie is set.

This is not an SSRF verifier or malware scanner: the server never fetches the
destination. DNS rebinding/private resolution, shared-hosting parent approval,
phishing screening and deployment-level abuse controls remain release concerns.
Do not assume hostname approval proves safety or ownership of landing pages.

## Campaign/domain binding

Requests require a current credential, Active campaign, enabled workspace,
at least one approved hostname and the campaign's owned, verified, unsuspended,
unarchived `TRANSPARENT_TRACKING` domain. The **Host header** must match the
assigned domain. Forwarded-host, referrer, user agent, IP and cookies cannot
select a different campaign/domain or target.

Credential generation uses 32 cryptographically random bytes. Only its SHA-256
hash and issuance timestamp are stored, and comparison is timing-safe. Owners
and members issue/rotate/revoke through authenticated, role-checked, rate-limited
actions with confirmation. The raw secret is revealed once in the response, not
saved as plaintext. Rotation/revocation affects subsequent lookups; an already
validated in-flight request has a point-in-time policy snapshot. Credential
operations do not silently advance an unsaved campaign form's policy revision.

There is no policy cache: fresh requests check current database configuration.
Authenticated campaigns are limited to **6,000 requests per 60-second fixed
window**, shared by that campaign, using Redis. Exhaustion returns 429 rather
than changing the destination. Ingress/DDoS protection must be supplied before
hosting; the campaign limiter is not an unauthenticated edge firewall.

## Durable privacy-preserving evidence

A successful redirect awaits a MySQL `RouteVerityRedirectAudit` insert before
returning. Milestone 4 reuses this same event for click reporting and asynchronously
enriched metadata, without adding a second redirect-path database operation.
It records random request/click IDs, timestamp, organisation/campaign IDs,
tracking host, destination hostname, SHA-256 fingerprints of provided/validated/
actual targets, validation result, HTTP status, decision timing, policy version
and app version. Target URLs, query values, fragments, raw credentials, IPs
and cookies are not stored as target/visitor data. Milestone 4 adds a bounded
pending user-agent string (cleared on enrichment), coarse device/browser/OS
and a referrer hostname only; no full referrer path/query is stored.
See [click analytics](click-analytics.md) for the user-approved privacy boundary.

Milestone 6 also captures optional bounded Google source metadata and advertising
identifier fingerprints, never raw GCLID/GBRAID/WBRAID values. These self-reported
fields do not affect redirect policy or device enrichment. Parallel tracking
does not automatically carry the response-header click ID to the merchant.

`processingTimeMs` measures decision preparation up to audit submission.
Structured completion logs and `Server-Timing` additionally measure elapsed
handler time including the audit await, excluding final network delivery.
Records describe a **prepared redirect**, not proof that the browser received
it or reached its landing page. A timed-out write may commit later without a
redirect being sent; never equate audit rows with completed visits.

SHA-256 is not encryption or guaranteed anonymisation. Low-entropy targets can
be guessed, and the records can still constitute personal data. Campaign
deletion retains minimal audit evidence; automatic expiry, organisation deletion
and comprehensive data export need explicit implementation before public hosting.
Filtered click CSV export is available; it is not a full GDPR export workflow.

Campaign pages provide a tenant-scoped, read-only view of the latest 50 records.
The runtime guard logs a critical incident and rejects any target mismatch.
Run the persisted integrity monitor:

```powershell
pnpm routeverity:redirect-audit
```

It emits a critical structured event and exits nonzero on validated/actual
fingerprint or status/result mismatches. It also exits nonzero on monitor
failure. Schedule it and connect critical events to alerts before deployment;
no hosted monitoring job or pager integration is claimed. The current app
version label identifies this local milestone; versioned corresponding source,
an exact release identifier and the AGPL source offer are release prerequisites.

## Local verification and hosting boundary

Run [local development](local-development.md), apply the additive schema while
the app is stopped, build, start and run `pnpm routeverity:e2e`. Tests use only
the isolated database and a synthetic verified tracking-domain fixture.
HTTP requests go to loopback with that fixture's Host header and never follow
redirects or fetch third-party landing pages. This is not a positive DNS/TLS
deployment test. There is no localhost HTTP next-hop exception.

The public `/tracking-domains` page accurately states that no RouteVerity public
tracking domain was deployed by this milestone. Tracking-domain DNS routing,
valid TLS, trusted reverse-proxy configuration, query-redacted access logs,
durable backups, privacy/retention, abuse operations and AGPL source publication
remain prerequisites. Restricted implementations and assets remain excluded.

See [failure modes](failure-modes.md) and [measured performance](redirect-performance.md).
