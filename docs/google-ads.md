# Google Ads setup and transparent request contract

Milestone 6 adds independently developed, locally testable Google Ads templates,
bounded ValueTrack reception and a campaign setup/validation tool.
Certification remains **NOT_SUBMITTED**. There is no live Google Ads account
test, public tracking-domain deployment or parallel-tracking certification.

## Official references and researched behavior

Reviewed on 2026-10-07:

- [Google ValueTrack and URL insertion](https://support.google.com/google-ads/answer/6305348?hl=en):
  templates need a final-URL insertion parameter; nested `{lpurl}` is escaped,
  while `{escapedlpurl}` explicitly escapes the final URL. `+2` and `+3` are
  multiple-escape variants for additional redirect layers. The documented
  `{gclid}` macro supplies a click identifier; no `{gbraid}` or `{wbraid}` macro
  is invented by RouteVerity.
- [Google URL options](https://support.google.com/google-ads/answer/6076199?hl=en):
  final URLs and tracking templates are different settings. More-specific
  templates override less-specific templates. HTTPS and server-side redirects
  are required. Google's Test button checks its own actual expansion/routing.
- [Parallel tracking](https://support.google.com/google-ads/answer/7544674?hl=en):
  mandatory for Search, Shopping, Display, Video and Performance Max; optional
  for Hotel campaigns. Customers go directly to the final URL while measurement
  runs separately in the background.

These references are not a claim that Google has approved RouteVerity.
The local expansion model below is not Google's live substitution engine.

## Setup wizard and validation utility

1. Create/select the RouteVerity campaign on Campaigns.
2. Approve every merchant landing hostname. Assign a verified, unsuspended
   transparent tracking domain, and activate the campaign.
3. Issue its tracking credential, or paste the current credential into the
   Google Ads setup form on the campaign detail page. Lost credentials must
   be rotated; hashes cannot be recovered.
4. Enter a representative **merchant HTTPS final URL**. Choose `{escapedlpurl}`
   (default single-escape variant) or nested `{lpurl}`.
5. Generate the copyable template and local expansion. The server validates
   membership/write role, current saved campaign/domain policy, current token,
   public HTTPS next-hop syntax, approved hostname and expanded query limits.
   No Google or merchant URL is fetched, and no click event is created here.
6. Keep the ad's Final URL set to the merchant page, not RouteVerity.
   Paste the generated template into the intended Google Ads campaign's
   tracking-template setting. Account-level use is possible only when **all**
   inheriting ads belong to this same RouteVerity campaign policy; it does not
   dynamically select a different RouteVerity campaign from `{campaignid}`.
7. After public DNS/TLS/deployment is ready, use Google Ads **Test** with real
   final URLs and verify actual expansion, redirect chain and target equality.
   Audit account/ad-group/ad/keyword/sitelink overrides before activation.
   RouteVerity does not write settings to a Google account.

Pattern (token is illustrative, not a valid runtime credential):

```text
https://YOUR-VERIFIED-TRACKING-HOST/click?url={escapedlpurl}&rv_campaign=YOUR-ROUTEVERITY-CAMPAIGN&rv_token=YOUR-TRACKING-CREDENTIAL&campaignid={campaignid}&adgroupid={adgroupid}&creative={creative}&matchtype={matchtype}&device={device}&network={network}&gclid={gclid}
```

Never publish generated templates or put them in third-party validators: they
contain a revocable bearer credential. Viewers cannot generate credentials or
templates. Setup errors clear previous generated output; the saved campaign
policy, not unsaved edits, is authoritative. Generation is a point-in-time
check; later suspension/rotation invalidates requests.

## URL encoding and final URL suffix

Keep macro braces **literal** in the template. Do not run the completed template
through `encodeURIComponent` or use `URLSearchParams` without restoring known
macro placeholders. The generator constructs literal placeholders itself.

The endpoint decodes the `url` field exactly once. The local preview models
one `encodeURIComponent(finalURL)` substitution; it is explicitly illustrative,
not proof of Google's encoding of every edge case. Ordinary direct test URLs
use `URLSearchParams({url, rv_campaign, rv_token})`, without pre-encoding url.
Do not use `{unescapedlpurl}`, `+2`, `+3`, nested external tracker chains or an
arbitrary user-supplied macro in this generator.

On success the validated next hop **equals the actual HTTP Location**.
ASCII query order, repeated merchant fields, existing percent escapes, literal
plus signs and fragments remain unchanged. International URLs receive existing
deterministic IDNA/URI encoding. Device, network and Google source fields never
choose, merge into or modify that next hop.

Google Final URL suffix belongs to Google's URL options, not this tracker.
Configure merchant parameters there if appropriate, and test their expanded
final URL. RouteVerity's stored UTMs are metadata only: no UTM/Google ID/click-ID
injection is performed. Source-like fields already inside `url` are merchant
content, not tracker controls; only their target fingerprint is persisted.

## Documented transparent-v2 parameter schema

`url`, `rv_campaign`, `rv_token` remain mandatory exactly once.
The following optional fields are accepted at most once, with empty values
treated as unavailable because some ValueTrack substitutions can be empty:

| Field                           | Accepted nonempty value                                              | Stored evidence                                                         |
| ------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| campaignid, adgroupid, creative | Positive decimal ID, 1-20 digits                                     | Bounded source value                                                    |
| matchtype                       | e, p, b                                                              | Source match type, not a keyword/search term                            |
| device                          | m, t, c                                                              | Google-supplied code, separate from UA-derived device                   |
| network                         | Lowercase alphanumeric token starting with a letter, 1-12 characters | Unverified source code; documented examples g, s, d, ytv, vp, gtv, x, e |
| gclid, gbraid, wbraid           | URL-safe letters/digits/underscore/hyphen, 1-512 characters          | SHA-256 fingerprint only                                                |

Identifiers are independently optional; the tracker neither requires one nor
chooses a preferred identifier when multiple are supplied. The generator emits
the documented `{gclid}` macro. Braid fields are accepted when actually supplied
by an integration, not generated from unsupported macros.

Duplicate fields (even empty or percent-encoded names), unresolved source
macros, unsafe/overlong values, malformed encoding and unknown top-level keys
return 400 with no redirect/event. Keyword, placement, targetid, location,
arbitrary custom parameters, gclsrc/gad_source and other undocumented fields
are intentionally not accepted in this v1 product schema. Expand support only
with a documented schema and tests, never a catch-all passthrough.
The 16,384-character query and 8,000-character destination limits still apply.

## Privacy, evidence and conversion limitations

The user explicitly chose **hash-only Google identifiers**. Raw GCLID/GBRAID/
WBRAID values are not stored in application audit rows or operational logs.
They are fingerprinted in the existing atomic redirect insert, alongside bounded
source metadata, with no extra request-path write, queue or enrichment call.
Legacy rows have no Google metadata. Tenant-scoped click details expose source
values/fingerprints; existing click CSV deliberately does not add advertising
data. Hashes are not encryption or guaranteed anonymisation; retention and
deletion controls are still required before hosting.

This choice **cannot support Google offline conversion uploads requiring raw
click identifiers**. No Google conversion upload, Ads API/OAuth integration,
enhanced conversions, personal-data hashing workflow or browser SDK is enabled.
Do not advertise this milestone as those capabilities.

Under parallel tracking, the browser may never traverse RouteVerity before the
merchant page. `X-RouteVerity-Click-Id` belongs to the measurement response and
does **not** automatically reach the merchant server. The independently verified
local product E2E test captures that header as an owned server integration,
then submits a conversion. It is **not** proof of automatic live Google-to-
merchant attribution. A future explicit correlation design is needed; do not
inject IDs into the transparent next hop to disguise this limitation.

Public ingress must redact bearer tracking URLs and raw advertising parameters.
Platform/proxy logs are outside application logging and can otherwise retain
them. TLS, routing, retention, abuse controls, AGPL source offer and live Google
Test verification remain release work, not completed deployment claims.

## Common errors and reproducible checks

- 400: double-encoded next hop, unresolved macro, duplicated auto-tagged field,
  unknown parameter, invalid source code or exceeded bounds. Inspect actual
  Google expansion privately and avoid sending duplicate fields.
- 403: merchant hostname is not approved; never substitute another destination.
- 404: inactive campaign/workspace, old token, wrong Host or unavailable domain.
- 429/503: rate exhaustion or dependency failure; no alternate/fallback redirect.
- Lost token: rotate through the campaign UI and update inheriting templates.
- Unexpected destination: check Google's most-specific template and Final URL
  settings; RouteVerity's database does not override the visible next hop.

Run the production app with the existing isolated services, then:

```powershell
pnpm routeverity:test
pnpm routeverity:e2e
pnpm routeverity:redirect-audit
```

Tests cover both insertion choices, one-decode preservation, bounded source
values, three hash-only identifiers, exact size boundaries, ambiguity/unknown
fields, roles/domains/tokens, Google-style UI template -> exact redirect ->
real analytics -> attributed immutable conversion -> exact dashboard revenue,
and identical next hops across Google/browser/device/network variants.
No paid Ads account, external landing fetch or live deployment is used.

Final local evidence (2026-10-07): production build/typecheck/scoped lint pass;
360 web tests plus 3 icon assertions and all 19 production browser/HTTP scenarios
pass. Persisted target-integrity, licensing exclusions and isolated services
pass. Source-export dry run selects 759 files; no new isolated export build,
source publication, live Google approval or certification is claimed.

See [transparent redirects](transparent-redirect.md), [conversions](conversions.md)
and [local development](local-development.md).
